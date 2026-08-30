export const VISIT_FORM_LABELS = {
  price: { CHEAP: "저렴", NORMAL: "보통", HIGH: "높은 편", VERY_HIGH: "매우 높음" },
  stay: {
    UNDER_30M: "30분 이하",
    ONE_HOUR: "1시간",
    ONE_HALF_HOUR: "1.5시간",
    TWO_HOURS: "2시간",
    OVER_TWO_HOURS: "2시간+",
  },
  takeout: { NONE: "거의 없음", LOW: "조금 있음", MEDIUM: "많음", HIGH: "매우 많음" },
  category: {
    COFFEE: "커피",
    NON_COFFEE: "논커피",
    DESSERT: "디저트",
    BAKERY: "베이커리",
    BRUNCH: "브런치",
    ETC: "기타",
  },
} as const;
