import { ICONS, type IconName } from './icons';

export function Icon({ name, size, cls }: { name: IconName; size?: 'lg' | 'xl'; cls?: string }) {
  return <svg class={`icon ${size ?? ''} ${cls ?? ''}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}
