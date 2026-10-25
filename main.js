import { FILM, PRICE_CATEGORIES, SEATS, SESSIONS } from "./data.js";
import { loadBookings, saveBookings } from "./storage.js";

const sessionById = new Map(SESSIONS.map(session => [session.id, session]));
const seatById = new Map(SEATS.map(seat => [seat.id, seat]));
const bookingForm = document.querySelector("#booking-form");
const confirmButton = document.querySelector("#confirm-booking");
const sessionOptions = document.querySelector("#session-options");
const sessionNote = document.querySelector("#session-note");
const seatPlan = document.querySelector("#seat-plan");
const seatList = document.querySelector("#seat-list");
const seatFilterLabel = document.querySelector("#seat-filter-label");
const selectedSeatsList = document.querySelector("#selected-seats");
const selectionEmpty = document.querySelector("#selection-empty");
const selectedCount = document.querySelector("#selected-count");
const orderSession = document.querySelector("#order-session");
const orderTotal = document.querySelector("#order-total");
const formError = document.querySelector("#form-error");
const appStatus = document.querySelector("#app-status");
const storageWarning = document.querySelector("#storage-warning");
const bookingsList = document.querySelector("#bookings-list");
const bookingsEmpty = document.querySelector("#bookings-empty");
const bookingsHeading = document.querySelector("#my-bookings-title");
const priceOptions = document.querySelector("#price-options");
const bookingStorageKey = "cinema-sever-bookings-v1";

const state = {
  activeSessionId: SESSIONS[0].id,
  categoryFilter: "all",
  selectedSeatIds: new Set(),
  bookings: [],
  submitting: false,
  storageError: ""
};

function isSeatId(value) {
  return typeof value === "string" && seatById.has(value);
}

function getBookingTotal(seatIds) {
  return seatIds.reduce((sum, id) => sum + seatById.get(id).price, 0);
}

function validateBooking(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.id !== "string" || !/^[\w-]{10,80}$/.test(value.id)) return false;
  if (typeof value.ticketNumber !== "string" || !/^KS-\d{6}-\d{2}$/.test(value.ticketNumber)) return false;
  if (!sessionById.has(value.sessionId) || !Array.isArray(value.seatIds) || value.seatIds.length === 0) return false;
  if (!value.seatIds.every(isSeatId) || new Set(value.seatIds).size !== value.seatIds.length) return false;
  if (!Number.isFinite(value.total) || value.total !== getBookingTotal(value.seatIds)) return false;
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) return false;
  const session = sessionById.get(value.sessionId);
  if (value.seatIds.some(id => session.initiallyOccupiedSeatIds.includes(id))) return false;
  return true;
}

function validateBookingCollection(bookings) {
  if (new Set(bookings.map(booking => booking.id)).size !== bookings.length) return false;
  if (new Set(bookings.map(booking => booking.ticketNumber)).size !== bookings.length) return false;
  const occupied = new Set();
  for (const booking of bookings) {
    for (const seatId of booking.seatIds) {
      const key = booking.sessionId + ":" + seatId;
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return true;
}

function getCurrentSession() {
  return sessionById.get(state.activeSessionId);
}

function isOccupied(session, seatId) {
  if (session.initiallyOccupiedSeatIds.includes(seatId)) return true;
  return state.bookings.some(booking =>
    booking.sessionId === session.id && booking.seatIds.includes(seatId)
  );
}

function getVisibleSeats() {
  return SEATS.filter(seat =>
    state.categoryFilter === "all" || seat.category === state.categoryFilter
  );
}

function formatMoney(amount) {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₽";
}

function seatWord(count) {
  const remainder100 = count % 100;
  const remainder10 = count % 10;
  if (remainder100 >= 11 && remainder100 <= 14) return "мест";
  if (remainder10 === 1) return "место";
  if (remainder10 >= 2 && remainder10 <= 4) return "места";
  return "мест";
}

function setError(message) {
  formError.textContent = message;
  formError.hidden = !message;
  appStatus.textContent = "";
}

function setStatus(message) {
  appStatus.textContent = message;
  formError.textContent = "";
  formError.hidden = true;
}

function renderSessionOptions() {
  sessionOptions.innerHTML = SESSIONS.map(session => {
    const active = session.id === state.activeSessionId;
    const occupiedCount = session.initiallyOccupiedSeatIds.length +
      state.bookings
        .filter(booking => booking.sessionId === session.id)
        .reduce((count, booking) => count + booking.seatIds.length, 0);
    return [
      '<button class="session-button" type="button" data-session-id="', session.id,
      '" aria-pressed="', String(active), '">',
      '<span class="session-time">', session.time, '</span>',
      '<span class="session-meta">', session.format, " · ", FILM.hall, "</span>",
      '<span class="session-availability">', String(SEATS.length - occupiedCount), " свободно</span>",
      "</button>"
    ].join("");
  }).join("");

  sessionOptions.querySelectorAll("[data-session-id]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.sessionId === state.activeSessionId) return;
      state.activeSessionId = button.dataset.sessionId;
      state.selectedSeatIds.clear();
      setStatus("Сеанс изменён — выбери места для нового времени.");
      render();
      const activeButton = sessionOptions.querySelector('[data-session-id="' + state.activeSessionId + '"]');
      if (activeButton) activeButton.focus();
    });
  });

  const activeSession = getCurrentSession();
  sessionNote.textContent = activeSession.time + " · " + activeSession.format + ". Занятость мест зависит от выбранного сеанса.";
}

function renderCategoryOptions() {
  priceOptions.querySelectorAll("[data-category]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.category === state.categoryFilter));
  });
}

function seatAccessibleLabel(seat, session) {
  if (isOccupied(session, seat.id)) return "Ряд " + seat.row + ", место " + seat.number + ", занято";
  if (state.selectedSeatIds.has(seat.id)) {
    return "Ряд " + seat.row + ", место " + seat.number + ", выбрано, " +
      PRICE_CATEGORIES[seat.category].name + ", " + seat.price + " рублей";
  }
  return "Ряд " + seat.row + ", место " + seat.number + ", свободно, " +
    PRICE_CATEGORIES[seat.category].name + ", " + seat.price + " рублей";
}

function renderSeatPlan() {
  const session = getCurrentSession();
  const visibleIds = new Set(getVisibleSeats().map(seat => seat.id));
  const rows = ["A", "B", "C", "D"];

  seatPlan.innerHTML = rows.map(row => {
    const rowSeats = SEATS.filter(seat => seat.row === row);
    const seatButtons = rowSeats.map(seat => {
      if (!visibleIds.has(seat.id)) return '<span class="seat-placeholder" aria-hidden="true"></span>';
      const occupied = isOccupied(session, seat.id);
      const selected = state.selectedSeatIds.has(seat.id);
      const statusClass = occupied ? "is-occupied" : selected ? "is-selected" : "is-free";
      const statusText = occupied ? "Занято" : selected ? "Выбрано" : "Свободно";
      return [
        '<button class="seat ', statusClass, '" type="button" data-seat-id="', seat.id,
        '" data-seat-source="plan" aria-label="', seatAccessibleLabel(seat, session),
        '" aria-pressed="', String(selected), '"', occupied ? " disabled" : "", ">",
        seat.number, '<span class="seat-status">', statusText, "</span></button>"
      ].join("");
    }).join("");
    return '<div class="seat-row"><span class="row-label">Ряд ' + row +
      '</span><div class="seat-row-items">' + seatButtons + "</div></div>";
  }).join("");

  seatPlan.querySelectorAll("[data-seat-id]").forEach(button => {
    button.addEventListener("click", () => toggleSeat(button.dataset.seatId, "plan"));
  });
}

function renderSeatList() {
  const session = getCurrentSession();
  const visibleSeats = getVisibleSeats();
  seatList.innerHTML = visibleSeats.map(seat => {
    const occupied = isOccupied(session, seat.id);
    const selected = state.selectedSeatIds.has(seat.id);
    const status = occupied ? "Занято" : selected ? "Выбрано" : "Свободно";
    const classes = "seat-list-item" + (occupied ? " is-occupied" : "") + (selected ? " is-selected" : "");
    return [
      '<li class="', classes, '"><button class="seat-list-button" type="button" data-seat-id="',
      seat.id, '" data-seat-source="list" aria-label="', seatAccessibleLabel(seat, session),
      '" aria-pressed="', String(selected), '"', occupied ? " disabled" : "", ">",
      '<span class="seat-list-place">', seat.id, "</span>",
      '<span class="seat-list-category">', PRICE_CATEGORIES[seat.category].name, "</span>",
      '<span class="seat-list-price">', formatMoney(seat.price), "</span>",
      '<span class="seat-list-status">', status, "</span>",
      "</button></li>"
    ].join("");
  }).join("");

  seatList.querySelectorAll("[data-seat-id]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector(".seat-list-details").open = true;
      toggleSeat(button.dataset.seatId, "list");
    });
  });

  seatFilterLabel.textContent = state.categoryFilter === "all"
    ? "Показаны все места"
    : 'Показана зона «' + PRICE_CATEGORIES[state.categoryFilter].name + "»";
}

function renderSelectedSeats() {
  const selected = Array.from(state.selectedSeatIds)
    .map(id => seatById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
  const session = getCurrentSession();
  orderSession.textContent = "Сеанс · " + session.time + " · " + session.format;
  selectedCount.textContent = selected.length + " " + seatWord(selected.length);
  selectionEmpty.hidden = selected.length > 0;
  selectedSeatsList.innerHTML = selected.map(seat => [
    "<li><span><strong>", seat.id, "</strong><span class=\"selected-category\">",
    PRICE_CATEGORIES[seat.category].name, "</span></span><span>", formatMoney(seat.price), "</span></li>"
  ].join("")).join("");
  orderTotal.textContent = formatMoney(getBookingTotal(selected.map(seat => seat.id)));
  confirmButton.disabled = state.submitting;
}

function renderBookings() {
  const ordered = [...state.bookings].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  bookingsEmpty.hidden = ordered.length > 0;
  bookingsList.innerHTML = ordered.map(booking => {
    const session = sessionById.get(booking.sessionId);
    const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" })
      .format(new Date(booking.createdAt));
    return [
      '<li class="booking-card"><div class="booking-card-main">',
      '<p class="eyebrow">Учебный билет · ', booking.ticketNumber, "</p>",
      "<h3>", FILM.title, "</h3>",
      "<p>", session.time, " · ", session.format, " · ", FILM.hall, "</p>",
      '<p>Места: <strong>', booking.seatIds.join(", "), "</strong></p>",
      '<p class="booking-date">Оформлен ', date, "</p>",
      '</div><div class="booking-card-price"><span>Итого</span><strong>',
      formatMoney(booking.total), "</strong>",
      '<button class="cancel-button" type="button" data-cancel-booking="', booking.id,
      '" aria-label="Отменить билет ', booking.ticketNumber, '">Отменить бронь</button>',
      "</div></li>"
    ].join("");
  }).join("");

  bookingsList.querySelectorAll("[data-cancel-booking]").forEach(button => {
    button.addEventListener("click", () => cancelBooking(button.dataset.cancelBooking));
  });
}

function renderStorageWarning() {
  storageWarning.hidden = !state.storageError;
  storageWarning.textContent = state.storageError || "";
}

function render() {
  renderSessionOptions();
  renderCategoryOptions();
  renderSeatPlan();
  renderSeatList();
  renderSelectedSeats();
  renderBookings();
  renderStorageWarning();
}

function toggleSeat(seatId, source) {
  const seat = seatById.get(seatId);
  const session = getCurrentSession();
  if (!seat || isOccupied(session, seatId)) return;

  if (state.selectedSeatIds.has(seatId)) state.selectedSeatIds.delete(seatId);
  else state.selectedSeatIds.add(seatId);
  setStatus(state.selectedSeatIds.size
    ? "Выбрано мест: " + state.selectedSeatIds.size + ". Сумма пересчитана."
    : "Выбор мест очищен.");
  render();
  const selector = source === "list"
    ? '.seat-list-button[data-seat-id="' + seatId + '"]'
    : '.seat[data-seat-id="' + seatId + '"]';
  const focusedButton = document.querySelector(selector);
  if (focusedButton) focusedButton.focus();
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "booking-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function createTicketNumber() {
  const suffix = String(Math.floor(Math.random() * 90) + 10);
  return "KS-" + Date.now().toString().slice(-6) + "-" + suffix;
}

function submitBooking(event) {
  event.preventDefault();
  if (state.submitting) return;
  state.submitting = true;
  confirmButton.disabled = true;
  formError.hidden = true;

  const session = getCurrentSession();
  const seatIds = Array.from(state.selectedSeatIds);
  if (seatIds.length === 0) {
    state.submitting = false;
    setError("Сначала выбери хотя бы одно свободное место.");
    confirmButton.disabled = false;
    return;
  }
  if (seatIds.some(id => !seatById.has(id) || isOccupied(session, id))) {
    state.submitting = false;
    state.selectedSeatIds.clear();
    setError("Одно из мест уже недоступно. Выбери места повторно.");
    render();
    return;
  }
  if (new Set(seatIds).size !== seatIds.length) {
    state.submitting = false;
    setError("В выборе обнаружились повторяющиеся места. Проверь план зала.");
    confirmButton.disabled = false;
    return;
  }

  const booking = {
    id: createId(),
    ticketNumber: createTicketNumber(),
    sessionId: session.id,
    seatIds: seatIds.sort((a, b) => a.localeCompare(b)),
    total: getBookingTotal(seatIds),
    createdAt: new Date().toISOString()
  };
  const nextBookings = [...state.bookings, booking];
  if (!validateBookingCollection(nextBookings)) {
    state.submitting = false;
    setError("Не удалось проверить состав билета. Бронь не создана.");
    confirmButton.disabled = false;
    return;
  }

  const result = saveBookings(nextBookings);
  if (!result.ok) {
    state.submitting = false;
    setError(result.error);
    confirmButton.disabled = false;
    return;
  }

  state.bookings = nextBookings;
  state.selectedSeatIds.clear();
  state.submitting = false;
  state.storageError = "";
  setStatus("Билет " + booking.ticketNumber + " сохранён. Места теперь заняты на сеанс " + session.time + ".");
  render();
}

function cancelBooking(bookingId) {
  const booking = state.bookings.find(item => item.id === bookingId);
  if (!booking) {
    setError("Этот билет уже отменён или не найден.");
    return;
  }
  const nextBookings = state.bookings.filter(item => item.id !== bookingId);
  const result = saveBookings(nextBookings);
  if (!result.ok) {
    setError(result.error);
    return;
  }

  state.bookings = nextBookings;
  state.storageError = "";
  state.selectedSeatIds.clear();
  setStatus("Билет " + booking.ticketNumber + " отменён. Места освобождены.");
  render();
  const nextCancelButton = bookingsList.querySelector("[data-cancel-booking]");
  if (nextCancelButton) nextCancelButton.focus();
  else {
    bookingsHeading.setAttribute("tabindex", "-1");
    bookingsHeading.focus();
  }
}

priceOptions.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  const nextCategory = button.dataset.category;
  if (nextCategory === state.categoryFilter) return;
  const hadSelection = state.selectedSeatIds.size > 0;
  state.categoryFilter = nextCategory;
  state.selectedSeatIds.clear();
  setStatus(hadSelection
    ? "Ценовая зона изменена — выбор мест сброшен."
    : "Список и план зала обновлены по ценовой зоне.");
  render();
  button.focus();
});

bookingForm.addEventListener("submit", submitBooking);

const loaded = loadBookings(validateBooking);
state.bookings = loaded.bookings;
state.storageError = loaded.error || "";
if (!validateBookingCollection(state.bookings)) {
  state.bookings = [];
  state.storageError = "Сохранённые билеты пересекаются по местам или повторяют номера. Они не загружены.";
}

render();
