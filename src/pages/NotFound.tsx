import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export const NotFound = () => (
  <Card className="flex flex-col items-center justify-center px-6 py-20 text-center">
    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--hairline)/0.06)] shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] text-muted">
      <Icon name="search" size={24} />
    </span>
    <h1 className="font-display text-headline-lg text-text">We couldn’t find that page</h1>
    <p className="mt-2 max-w-sm text-body-md text-muted">
      The link may be out of date. Your dashboard has everything in one place.
    </p>
    <ButtonLink to="/" variant="primary" className="mt-6">
      Back to dashboard
    </ButtonLink>
  </Card>
);
