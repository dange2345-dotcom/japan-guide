import type { ComponentChildren } from 'preact'

// Иконки — свои SVG одной толщины линии (1.75), цвет — currentColor.

interface IconProps {
  size?: number
  class?: string
}

function Icon(props: IconProps & { children: ComponentChildren; fill?: boolean }) {
  const size = props.size ?? 22
  return (
    <svg
      class={props.class}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={props.fill ? 'currentColor' : 'none'}
      stroke={props.fill ? 'none' : 'currentColor'}
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  )
}

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
)

export const IconInbox = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 13.5 6 5.5h12l2.5 8" />
    <path d="M3.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-4.5H16a4 4 0 0 1-8 0H3.5Z" />
  </Icon>
)

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Icon>
)

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const IconBack = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5 8 12l7 7" />
  </Icon>
)

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const IconMap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
)

export const IconLink = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
)

export const IconCamera = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
    <circle cx="12" cy="13" r="3.3" />
  </Icon>
)

export const IconStar = (p: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={p.filled}>
    <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8Z" />
  </Icon>
)

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
  </Icon>
)

export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 19h3.5L19 8.5 15.5 5 5 15.5Z" />
    <path d="m13.5 7 3.5 3.5" />
  </Icon>
)

export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
)

export const IconUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 15 6-6 6 6" />
  </Icon>
)

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
  </Icon>
)

export const IconCopy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
    <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </Icon>
)

export const IconPeople = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 5.7a3 3 0 0 1 0 5.6M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
  </Icon>
)

export const IconSync = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.8M4.5 12a7.5 7.5 0 0 1 13.2-4.8" />
    <path d="M18 3.5v3.8h-3.8M6 20.5v-3.8h3.8" />
  </Icon>
)

export const IconOut = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4.5h4A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-4" />
    <path d="M10 8 6 12l4 4M6 12h9.5" />
  </Icon>
)

export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13H6.5A1.5 1.5 0 0 0 5 18.5Z" />
    <path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19M9 8h6" />
  </Icon>
)

export const IconTrain = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="3.5" width="12" height="13" rx="3" />
    <path d="M6 10h12M9.5 13.5h.01M14.5 13.5h.01M8.5 20l1.5-3.5M15.5 20 14 16.5" />
  </Icon>
)

/** «あ» — показать по-японски. */
export const IconKana = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 6.5h9M11 4v9.5c0 3-1.5 5.5-3.5 5.5S5 17.5 5.5 15.5C6.3 12.7 10.5 11 13.5 11c3 0 5.5 1.6 5.5 4.2 0 2.4-2 3.8-4.5 4.3" />
  </Icon>
)

/* Иконки разделов — для вкладок. */

export const IconFood = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12.5h16a8 8 0 0 1-16 0Z" />
    <path d="M13 3.5 9.5 12.5M17.5 5l-5.5 7.5" />
  </Icon>
)

export const IconTorii = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 5.5c3 .8 14 .8 17 0M5.5 9.5h13M7.5 6.5v14M16.5 6.5v14M12 6.5v3" />
  </Icon>
)

export const IconBag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 8h13l-1 12h-11Z" />
    <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
  </Icon>
)

export const IconBed = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 19.5v-12M3.5 15h17v4.5M20.5 15v-3a3 3 0 0 0-3-3H11v6" />
    <circle cx="7.3" cy="11.3" r="1.8" />
  </Icon>
)
