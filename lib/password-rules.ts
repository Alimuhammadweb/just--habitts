// Parol qoidalari (mijoz va server uchun umumiy, Node'ga bog'liq emas)
export const PASSWORD_MIN = 8
export function passwordProblems(pw: string): string[] {
  const out: string[] = []
  if (pw.length < PASSWORD_MIN) out.push(`Kamida ${PASSWORD_MIN} ta belgi`)
  if (!/[A-Za-z]/.test(pw)) out.push("Kamida bitta harf")
  if (!/\d/.test(pw)) out.push("Kamida bitta raqam")
  if (pw.length > 128) out.push("Eng ko'pi bilan 128 ta belgi")
  return out
}
