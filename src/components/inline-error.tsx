import { AnimatePresence, motion } from "motion/react";
import { easeOut } from "@/lib/motion";

function InlineError({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          role="alert"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 2 }}
          transition={{ duration: 0.18, ease: easeOut }}
          className="min-w-0 break-words text-sm text-destructive"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export { InlineError };
