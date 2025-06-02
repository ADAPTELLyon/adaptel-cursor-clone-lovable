import ephemeris from "./ephemeris-data.json"

export function getTodayEphemerisName(date = new Date()): string | undefined {
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return ephemeris[month]?.[day]
}
