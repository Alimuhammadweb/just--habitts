export function getDeleteConfirmation(): string {
  const language = localStorage.getItem("habit-language") || "uz"

  if (language === "uz") return "Bu odatni o'chirishni istaysizmi?"
  if (language === "ru") return "Вы хотите удалить эту привычку?"
  return "Do you want to delete this habit?"
}
