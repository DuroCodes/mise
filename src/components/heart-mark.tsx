import { HeartIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { easeOut } from "@/lib/motion";

function HeartMark({ filled }: { filled: boolean }) {
  return (
    <AnimatePresence initial={false}>
      <motion.span
        key={filled ? "on" : "off"}
        className="inline-flex"
        initial={filled ? { scale: 0.72 } : false}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2, ease: easeOut }}
      >
        <HeartIcon className={filled ? "fill-current" : undefined} />
      </motion.span>
    </AnimatePresence>
  );
}

export { HeartMark };
