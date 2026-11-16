const easeOut = [0.16, 1, 0.3, 1] as const;
const easeIn = [0.7, 0, 0.84, 0] as const;

const rise = { duration: 0.28, ease: easeOut };
const leave = { duration: 0.16, ease: easeIn };

export { easeIn, easeOut, leave, rise };
