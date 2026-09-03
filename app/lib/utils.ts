// Amounts are assumed to be stored in paise (minor units) and formatted as
// Indian Rupees, per docs/prd/00-master-prd.md §11 ("Currency: Indian Rupee").
export const formatCurrency = (amountInPaise: number) => {
  return (amountInPaise / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
};

export const formatDateToLocal = (
  dateStr: string,
  locale: string = 'en-IN',
) => {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  const formatter = new Intl.DateTimeFormat(locale, options);
  return formatter.format(date);
};

export const generatePagination = (currentPage: number, totalPages: number) => {
  // If the total number of pages is 7 or less,
  // display all pages without any ellipsis.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // If the current page is among the first 3 pages,
  // show the first 3, an ellipsis, and the last 2 pages.
  if (currentPage <= 3) {
    return [1, 2, 3, '...', totalPages - 1, totalPages];
  }

  // If the current page is among the last 3 pages,
  // show the first 2, an ellipsis, and the last 3 pages.
  if (currentPage >= totalPages - 2) {
    return [1, 2, '...', totalPages - 2, totalPages - 1, totalPages];
  }

  // If the current page is somewhere in the middle,
  // show the first page, an ellipsis, the current page and its neighbors,
  // another ellipsis, and the last page.
  return [
    1,
    '...',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    '...',
    totalPages,
  ];
};

/**
 * An amount in whole rupees, formatted for display.
 *
 * Distinct from `formatCurrency` above, which divides by 100 because it was written
 * for amounts stored in paise. `buildcore-api` sends money as Prisma `Decimal`
 * columns in rupees — `contractValue: "25000000.00"` is ₹2.5 crore, not ₹2.5 lakh —
 * so passing those through the paise formatter would understate every figure on the
 * screen by two orders of magnitude.
 *
 * `en-IN` rather than a manual lakh/crore split: `Intl` already groups Indian digits
 * correctly (₹2,50,00,000), and reimplementing that grouping is how it ends up
 * subtly wrong for eight-digit values.
 */
export const formatRupees = (amountInRupees: number) =>
  amountInRupees.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
