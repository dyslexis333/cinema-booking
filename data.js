export const FILM = {
  title: "Человек-паук: Новый день",
  hall: "Большой зал · зал 2"
};

export const SESSIONS = [
  {
    id: "evening-1730",
    time: "17:30",
    format: "2D",
    initiallyOccupiedSeatIds: ["A3", "C5"]
  },
  {
    id: "evening-2015",
    time: "20:15",
    format: "2D",
    initiallyOccupiedSeatIds: ["B2", "D4"]
  }
];

export const PRICE_CATEGORIES = {
  standard: { id: "standard", name: "Стандарт", price: 420 },
  comfort: { id: "comfort", name: "Комфорт", price: 560 }
};

export const SEATS = ["A", "B", "C", "D"].flatMap((row, rowIndex) =>
  Array.from({ length: 6 }, (_, index) => {
    const category = rowIndex < 2 ? "standard" : "comfort";
    return {
      id: row + (index + 1),
      row,
      number: index + 1,
      category,
      price: PRICE_CATEGORIES[category].price
    };
  })
);
