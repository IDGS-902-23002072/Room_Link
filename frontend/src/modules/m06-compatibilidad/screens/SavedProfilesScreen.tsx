import React, { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, ScreenLayout } from '../../../shared/components';
import { ProfileListItem } from '../components/ProfileListItem';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { discardedCount, savedCount, savedProfilesMock } from '../data/mock';
import { M06StackParamList } from '../../../modules/m06-compatibilidad/types';

type Props = NativeStackScreenProps<M06StackParamList, 'SavedProfiles'>;

export default function SavedProfilesScreen({ navigation }: Props) {
  const [tab, setTab] = useState<'saved' | 'discarded'>('saved');

  // Según el diseño se muestran ambos tipos en la lista; el tab sólo resalta el filtro activo.
  // Cambia a `filter` si quieres que el tab filtre de verdad.
  const profiles = useMemo(() => savedProfilesMock, []);

  return (
    <ScreenLayout
      eyebrow="ROOMLINK / 06"
      title="Tus perfiles"
      subtitle="Retoma tus opciones cuando quieras."
    >
      <SegmentedTabs
        saved={savedCount}
        discarded={discardedCount}
        active={tab}
        onChange={setTab}
      />
      {profiles.map((p) => (
        <ProfileListItem key={p.id} profile={p} />
      ))}
      <Button
        variant="secondary"
        label="Explorar más roomies"
        onPress={() => navigation.popToTop()}
      />
    </ScreenLayout>
  );
}
