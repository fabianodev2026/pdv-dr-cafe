import { supabase } from './supabaseClient'

export interface StoreSchedule {
  weekdayOpen: string
  weekdayClose: string
  saturdayOpen: string
  saturdayClose: string
  sundayEnabled: boolean
  sundayOpen: string
  sundayClose: string
}

export const DEFAULT_STORE_SCHEDULE: StoreSchedule = {
  weekdayOpen: '08:00',
  weekdayClose: '20:00',
  saturdayOpen: '08:00',
  saturdayClose: '14:30',
  sundayEnabled: false,
  sundayOpen: '08:00',
  sundayClose: '14:00',
}

const toHHMM = (value?: string | null) => (value ? value.slice(0, 5) : undefined)

export async function fetchStoreSchedule(): Promise<StoreSchedule> {
  try {
    const { data, error } = await supabase
      .from('store_schedule')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (error || !data) return DEFAULT_STORE_SCHEDULE

    return {
      weekdayOpen: toHHMM(data.weekday_open) ?? DEFAULT_STORE_SCHEDULE.weekdayOpen,
      weekdayClose: toHHMM(data.weekday_close) ?? DEFAULT_STORE_SCHEDULE.weekdayClose,
      saturdayOpen: toHHMM(data.saturday_open) ?? DEFAULT_STORE_SCHEDULE.saturdayOpen,
      saturdayClose: toHHMM(data.saturday_close) ?? DEFAULT_STORE_SCHEDULE.saturdayClose,
      sundayEnabled: Boolean(data.sunday_enabled),
      sundayOpen: toHHMM(data.sunday_open) ?? DEFAULT_STORE_SCHEDULE.sundayOpen,
      sundayClose: toHHMM(data.sunday_close) ?? DEFAULT_STORE_SCHEDULE.sundayClose,
    }
  } catch {
    return DEFAULT_STORE_SCHEDULE
  }
}

export async function saveStoreSchedule(schedule: StoreSchedule) {
  return supabase.from('store_schedule').upsert({
    id: 1,
    weekday_open: schedule.weekdayOpen,
    weekday_close: schedule.weekdayClose,
    saturday_open: schedule.saturdayOpen,
    saturday_close: schedule.saturdayClose,
    sunday_enabled: schedule.sundayEnabled,
    sunday_open: schedule.sundayOpen,
    sunday_close: schedule.sundayClose,
    updated_at: new Date().toISOString(),
  })
}

function toMinutes(hhmm: string) {
  const [hours, minutes] = hhmm.split(':').map((part) => Number.parseInt(part, 10) || 0)
  return hours * 60 + minutes
}

export function getScheduleMessage(schedule: StoreSchedule) {
  const sundayPart = schedule.sundayEnabled
    ? `domingo das ${schedule.sundayOpen} as ${schedule.sundayClose}`
    : 'domingo fechado'

  return `Funcionamento do app: segunda a sexta das ${schedule.weekdayOpen} as ${schedule.weekdayClose}, sabado das ${schedule.saturdayOpen} as ${schedule.saturdayClose} e ${sundayPart}.`
}

export function getAppOrderAvailability(schedule: StoreSchedule, date = new Date()) {
  const weekDay = date.getDay()
  const isSunday = weekDay === 0
  const isSaturday = weekDay === 6
  const currentMinutes = date.getHours() * 60 + date.getMinutes()
  const scheduleMessage = getScheduleMessage(schedule)

  if (isSunday && !schedule.sundayEnabled) {
    return {
      isOpen: false,
      message: `Pedidos pelo app ficam fechados aos domingos. A loja nao abre no domingo. ${scheduleMessage}`,
    }
  }

  const [openStr, closeStr] = isSunday
    ? [schedule.sundayOpen, schedule.sundayClose]
    : isSaturday
      ? [schedule.saturdayOpen, schedule.saturdayClose]
      : [schedule.weekdayOpen, schedule.weekdayClose]

  const opensAtMinutes = toMinutes(openStr)
  const closesAtMinutes = toMinutes(closeStr)

  if (currentMinutes < opensAtMinutes || currentMinutes > closesAtMinutes) {
    return {
      isOpen: false,
      message: scheduleMessage,
    }
  }

  return { isOpen: true, message: '' }
}
