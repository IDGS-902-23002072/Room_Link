const paths = {
  menu: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16M13 9h4M13 13h4" /></>,
  pin: <><path d="m9 3 6 0-1 6 4 4H6l4-4-1-6ZM12 13v8" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  messages: <path d="M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0ZM7 10h10M7 14h6" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 9h18c0-1-3-1-3-9ZM9 21h6" /></>,
  test: <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="m8 9 2 2 5-5M8 15h8M8 18h5" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 4 5" /></>,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></>,
  home: <><path d="m3 10 9-7 9 7v10H3ZM9 20v-7h6v7" /></>,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
  spark: <path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z" />,
  plus: <path d="M12 4v16M4 12h16" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  logout: <><path d="M10 4H4v16h6M10 12h11m-5-5 5 5-5 5" /></>,
}

export default function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.home}</svg>
}
