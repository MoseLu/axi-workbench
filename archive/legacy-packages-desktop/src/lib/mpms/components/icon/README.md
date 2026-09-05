# Icon

Atomic icon component using `mask-image` for `currentColor` support.

## Usage

```tsx
import { Icon, IconProvider } from '@mpms/ui';

// Provide a custom resolver
const resolver = (name: string) => `/icons/${name}.svg`;

<IconProvider resolver={resolver}>
  <Icon name="system-github" size={16} />
</IconProvider>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| name | string | — | Icon name, resolved via IconProvider |
| size | number | 20 | Icon size in px |
| color | string | currentColor | Icon color |
| className | string | '' | Additional CSS class |
| onClick | () => void | — | Click handler |
