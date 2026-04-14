export default function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      {message && (
        <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
          {message}
        </span>
      )}
    </div>
  );
}
