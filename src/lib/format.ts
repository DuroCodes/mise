export const formatMinutes = (minutes: number | null) => {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
};

export const totalMinutes = (prep: number | null, cook: number | null) => {
  if (prep === null && cook === null) return null;
  return (prep ?? 0) + (cook ?? 0);
};

export const ingredientLine = (item: {
  amount: string;
  unit: string;
  name: string;
}) => [item.amount, item.unit, item.name].filter(Boolean).join(" ");
