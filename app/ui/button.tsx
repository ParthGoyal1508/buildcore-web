import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function Button({ children, className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(
        // Base is the brand navy itself, and hover goes *lighter* rather than the
        // usual darker: at #002d4e the shades below it are nearly black, so darkening
        // gives no visible feedback. Active still darkens, so a press reads.
        'flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:bg-blue-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600',
        className,
      )}
    >
      {children}
    </button>
  );
}
