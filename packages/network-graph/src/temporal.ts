interface ValidityWindow {
  from: string;
  to: string | null;
}

export function filterAsOf<T extends { validity: ValidityWindow[] }>(
  entities: T[],
  date: string,
): T[] {
  return entities.filter((entity) =>
    entity.validity.some(
      (window) =>
        window.from <= date && (window.to === null || window.to > date),
    ),
  );
}
