const STORAGE_KEY = "cinema-sever-bookings-v1";

export function loadBookings(validate) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { bookings: [], error: null };

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validate)) {
      return {
        bookings: [],
        error: "Сохранённые билеты имеют неверный формат. Страница продолжит работу, но повреждённые записи не загружены."
      };
    }

    return { bookings: parsed, error: null };
  } catch (error) {
    return {
      bookings: [],
      error: error instanceof SyntaxError
        ? "Не удалось прочитать сохранённые билеты: данные повреждены. Страница продолжит работу."
        : "Браузер не разрешил прочитать сохранённые билеты. Страница продолжит работу без них."
    };
  }
}

export function saveBookings(bookings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    return { ok: true, error: null };
  } catch {
    return {
      ok: false,
      error: "Не удалось сохранить билет. Проверьте настройки хранения браузера; бронь не добавлена."
    };
  }
}
