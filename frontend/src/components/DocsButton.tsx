import { useState } from 'react';
import { Drawer } from 'flowbite-react';
import { HiBookOpen } from 'react-icons/hi';
import Button from './Button';
import Docs from './Docs';

interface DocsButtonProps {
  label?: string;
  className?: string;
}

// A self-contained "Docs" button + drawer so documentation is reachable from
// every surface (setup wizard, the Docker-required screen, the dashboard)
// without each one wiring up its own state. Only one surface renders at a time,
// so a drawer per button is fine.
export default function DocsButton({ label = 'Docs', className = '' }: DocsButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} tooltip="Documentation" className={className}>
        <HiBookOpen className="inline-block mr-1" /> {label}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        position="right"
        className="!w-[1000px] max-w-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700"
      >
        <div className="h-full bg-white dark:bg-gray-800">
          <Docs />
        </div>
      </Drawer>
    </>
  );
}
