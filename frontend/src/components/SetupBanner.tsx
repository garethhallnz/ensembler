import Alert from './Alert';
import Button from './Button';
import { HiExternalLink } from 'react-icons/hi';

interface SetupBannerProps {
  // The remaining setup step, in plain language
  message: React.ReactNode;
  // Button label, e.g. "Open Prowlarr"
  actionLabel: string;
  onAction: () => void;
}

// A dashboard banner prompting the one manual step a service still needs
// (add an indexer, sign in, etc.). Shared so every such prompt looks and
// behaves the same as more services gain guided setup.
export default function SetupBanner({ message, actionLabel, onAction }: SetupBannerProps) {
  return (
    <div className="mb-6">
      <Alert color="info">
        <div className="flex items-center justify-between gap-4">
          <div className="text-left">{message}</div>
          <Button size="sm" onClick={onAction}>
            <HiExternalLink className="inline-block mr-1" /> {actionLabel}
          </Button>
        </div>
      </Alert>
    </div>
  );
}
