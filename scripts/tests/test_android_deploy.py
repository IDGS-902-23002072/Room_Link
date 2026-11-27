"""Pruebas sin red de publicación: checksum, reemplazo atómico y fallos."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import hashlib

ROOT = Path(__file__).resolve().parents[2]

MOCK = r'''#!/usr/bin/env python3
import os, pathlib, subprocess, sys, shutil
name = pathlib.Path(sys.argv[0]).name
root = pathlib.Path(os.environ['FAKE_DOWNLOADS'])
args = sys.argv[1:]
if name == 'ssh':
    if 'bash' in args:
        script = sys.stdin.read().replace('/opt/roomlink/downloads', str(root))
        sys.exit(subprocess.run(['bash', '-s', '--', *args[-2:]], input=script, text=True).returncode)
    (root / args[-1].split('/')[-1]).mkdir(parents=True, exist_ok=True)
elif name == 'scp':
    if os.environ.get('FAIL_UPLOAD') == '1': sys.exit(1)
    destination = root / '/'.join(args[-1].split('/')[-2:])
    shutil.copyfile(args[-2], destination)
    if os.environ.get('CORRUPT_UPLOAD') == '1': destination.write_bytes(b'corrupt')
elif name == 'curl':
    shutil.copyfile(root / 'roomlink.apk', args[-1])
'''


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'bin').mkdir()
        (self.root / 'apk').mkdir()
        (self.root / 'downloads').mkdir()
        self.previous = self.root / 'downloads/roomlink.apk'
        self.previous.write_bytes(b'previous-release')
        payload = b'new-signed-apk-fixture'
        (self.root / 'apk/roomlink.apk').write_bytes(payload)
        (self.root / 'apk/roomlink.apk.sha256').write_text(hashlib.sha256(payload).hexdigest() + '  roomlink.apk\n')
        for name in ('ssh', 'scp', 'curl'):
            path = self.root / 'bin' / name
            path.write_text(MOCK)
            path.chmod(0o755)
        self.env = {
            **os.environ,
            'PATH': f"{self.root / 'bin'}:{os.environ['PATH']}",
            'SSH_HOST': 'example.test', 'SSH_USER': 'deploy', 'SSH_KEY': 'test-key',
            'SSH_KNOWN_HOSTS': 'test-host', 'API_URL': 'https://example.test',
            'RUNNER_TEMP': str(self.root), 'GITHUB_RUN_ID': '123', 'GITHUB_RUN_ATTEMPT': '1',
            'FAKE_DOWNLOADS': str(self.root / 'downloads'),
            'GITHUB_STEP_SUMMARY': str(self.root / 'summary'),
        }

    def run_deploy(self):
        return subprocess.run(['bash', str(ROOT / 'scripts/deploy-android-apk.sh')],
                              cwd=self.root, env=self.env, capture_output=True, text=True)

    def test_publish_preserves_previous_and_cleans_key(self):
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.previous.read_bytes(), b'new-signed-apk-fixture')
        self.assertEqual((self.root / 'downloads/roomlink.previous.apk').read_bytes(), b'previous-release')
        self.assertFalse(list(self.root.glob('apk-ssh.*')))
        self.assertIn('Descargar RoomLink', (self.root / 'summary').read_text())

    def test_corrupt_upload_never_replaces_previous(self):
        self.env['CORRUPT_UPLOAD'] = '1'
        self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertEqual(self.previous.read_bytes(), b'previous-release')
        self.assertFalse(list(self.root.glob('apk-ssh.*')))

    def test_upload_failure_never_replaces_previous(self):
        self.env['FAIL_UPLOAD'] = '1'
        self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertEqual(self.previous.read_bytes(), b'previous-release')

    def test_missing_secret_fails_before_upload(self):
        self.env['SSH_KEY'] = ''
        self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertEqual(self.previous.read_bytes(), b'previous-release')


if __name__ == '__main__':
    unittest.main()
