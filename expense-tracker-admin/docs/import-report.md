# Import report — Expenditure Tracker

- Source: `docs/expenditure.xlsx` (sheet "Sheet1")
- Year: 2026
- Generated: 2026-11-11T10:24:36.522Z

## Rules applied

- Amounts are parsed with `parseLegacyAmount()`; totals are always recomputed as unit cost × quantity.
- The month block is the source of truth for the month/year; the date cell only supplies the day.
- Item names are trimmed and de-duplicated case-insensitively within a category. Spelling is never corrected.
- Missing values are never invented: rows without a unit cost, quantity, date or amount are skipped and listed below.

## Summary

| Categories | Items | Expenses | Petty cash entries | Opening balance |
|---|---|---|---|---|
| 4 | 78 | 291 | 71 | GH₵ 930.25 (January) |

Anomalies: **76** — 1 errors, 56 warnings, 19 info.

| Type | Count |
|---|---|
| month_mismatch | 25 |
| petty_cash_mismatch | 12 |
| total_mismatch | 10 |
| name_whitespace | 7 |
| grand_total_mismatch | 7 |
| text_date | 4 |
| odd_date | 4 |
| amount_format | 3 |
| missing_value | 1 |
| category_mapped | 1 |
| duplicate_across_categories | 1 |
| opening_balance | 1 |

## By month

| Month | Expenses | Computed total | Sheet grand total | Difference | Petty cash entries | Cash-in | Cash-out |
|---|---|---|---|---|---|---|---|
| January | 34 | GH₵ 6,783.06 | GH₵ 6,691.06 | GH₵ -92.00 | 10 | GH₵ 1,471.97 | GH₵ 4,699.41 |
| February | 18 | GH₵ 2,639.27 | GH₵ 2,777.00 | GH₵ 137.73 | 11 | GH₵ 2,000.00 | GH₵ 2,653.09 |
| March | 53 | GH₵ 8,459.72 | GH₵ 8,432.72 | GH₵ -27.00 | 9 | GH₵ 652.00 | GH₵ 3,092.75 |
| April | 14 | GH₵ 2,013.05 | GH₵ 2,013.05 | GH₵ 0.00 | 9 | GH₵ 14.52 | GH₵ 1,842.43 |
| May | 32 | GH₵ 5,255.41 | GH₵ 4,376.92 | GH₵ -878.49 | 16 | GH₵ 2,698.14 | GH₵ 4,289.47 |
| June | 59 | GH₵ 7,971.42 | GH₵ 8,612.91 | GH₵ 641.49 | 16 | GH₵ 0.00 | GH₵ 1,823.88 |
| July | 10 | GH₵ 1,825.00 | GH₵ 1,825.00 | GH₵ 0.00 | 0 | GH₵ 0.00 | GH₵ 0.00 |
| August | 15 | GH₵ 4,211.00 | GH₵ 4,211.00 | GH₵ 0.00 | 0 | GH₵ 0.00 | GH₵ 0.00 |
| September | 47 | GH₵ 6,206.50 | GH₵ 6,258.50 | GH₵ 52.00 | 0 | GH₵ 0.00 | GH₵ 0.00 |
| October | 9 | GH₵ 303.00 | — | — | 0 | GH₵ 0.00 | GH₵ 0.00 |

## Categories

1. Office Supplies
2. Kitchen Supplies
3. Cleaning & Hygiene Supplies (sheet label: "Cleaning & Hygine supplies")
4. Other

## Errors (not imported or unreadable) (1)

| ID | Location | Month | Type | Problem | Suggested action |
|---|---|---|---|---|---|
| A0008 | Sheet1!AV26:AZ26 | October | missing_value | Entry for "Electricity" is missing quantity, date; not imported | Missing values are never invented — enter this record manually if it is real |

## Warnings (56)

| ID | Location | Month | Type | Problem | Suggested action |
|---|---|---|---|---|---|
| A0002 | Sheet1!AA12 | May | month_mismatch | Date 2026-06-05 is outside its month block; 2026-05 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0003 | Sheet1!L20 | February | month_mismatch | Date 2025-02-25 is outside its month block; 2026-02 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0004 | Sheet1!P20 | March | total_mismatch | Total GH₵ 209.00 ≠ GH₵ 10.00 × 2 = GH₵ 20.00 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0005 | Sheet1!AA20 | May | month_mismatch | Date 2026-06-05 is outside its month block; 2026-05 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0006 | Sheet1!AU23 | September | month_mismatch | Date 2026-06-11 is outside its month block; 2026-09 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0009 | Sheet1!AU28 | September | month_mismatch | Date 2026-06-25 is outside its month block; 2026-09 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0010 | Sheet1!AA34 | May | month_mismatch | Date 2026-06-05 is outside its month block; 2026-05 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0011 | Sheet1!AA37 | May | month_mismatch | Date 2026-06-05 is outside its month block; 2026-05 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0012 | Sheet1!AA38 | May | month_mismatch | Date 2026-06-05 is outside its month block; 2026-05 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0013 | Sheet1!F40 | January | total_mismatch | Total GH₵ 92.00 ≠ GH₵ 92.00 × 2 = GH₵ 184.00 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0014 | Sheet1!AA40 | May | month_mismatch | Date 2026-06-05 is outside its month block; 2026-05 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0015 | Sheet1!AF43 | June | month_mismatch | Date 2026-08-28 is outside its month block; 2026-06 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0017 | Sheet1!AF46 | June | month_mismatch | Date 2026-05-05 is outside its month block; 2026-06 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0018 | Sheet1!AF47 | June | month_mismatch | Date 2026-05-05 is outside its month block; 2026-06 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0020 | Sheet1!AA51 | May | month_mismatch | Date 2026-06-05 is outside its month block; 2026-05 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0021 | Sheet1!AU51 | September | month_mismatch | Date 2026-08-14 is outside its month block; 2026-09 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0023 | Sheet1!AA56 | May | month_mismatch | Date 2026-06-05 is outside its month block; 2026-05 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0024 | Sheet1!AP56 | August | month_mismatch | Date 2028-08-31 is outside its month block; 2026-08 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0025 | Sheet1!AU59 | September | month_mismatch | Date 2026-06-14 is outside its month block; 2026-09 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0026 | Sheet1!AE60 | June | total_mismatch | Total GH₵ 41.40 ≠ GH₵ 41.50 × 1 = GH₵ 41.50 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0027 | Sheet1!AE61 | June | total_mismatch | Total GH₵ 13.00 ≠ GH₵ 138.00 × 1 = GH₵ 138.00 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0029 | Sheet1!AY75 | October | total_mismatch | Total GH₵ 46.00 ≠ GH₵ 23.00 × 1 = GH₵ 23.00 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0030 | Sheet1!Q76 | March | month_mismatch | Date 2027-03-12 is outside its month block; 2026-03 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0031 | Sheet1!AF76 | June | text_date | Date typed as text ("09/06/206") | Verify the date |
| A0032 | Sheet1!AF76 | June | odd_date | Malformed year "206" | Verify the date |
| A0033 | Sheet1!AE76 | June | total_mismatch | Total GH₵ 246.00 ≠ GH₵ 46.00 × 1 = GH₵ 46.00 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0034 | Sheet1!Q77 | March | text_date | Date typed as text ("12-13/03/2026") | Verify the date |
| A0035 | Sheet1!Q77 | March | odd_date | Date range "12-13/03/2026"; the first day (12) was used | Verify the date |
| A0036 | Sheet1!AE78 | June | total_mismatch | Total GH₵ 53.00 ≠ GH₵ 52.00 × 1 = GH₵ 52.00 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0037 | Sheet1!AT85 | September | total_mismatch | Total GH₵ 81.00 ≠ GH₵ 59.00 × 1 = GH₵ 59.00 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0038 | Sheet1!AU86 | September | month_mismatch | Date 2026-06-25 is outside its month block; 2026-09 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0039 | Sheet1!Q89 | March | month_mismatch | Date 2026-02-04 is outside its month block; 2026-03 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0041 | Sheet1!AU91 | September | month_mismatch | Date 2026-06-25 is outside its month block; 2026-09 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0042 | Sheet1!AT91 | September | total_mismatch | Total GH₵ 62.00 ≠ GH₵ 46.00 × 1 = GH₵ 46.00 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0043 | Sheet1!G105 | January | month_mismatch | Date 2025-01-16 is outside its month block; 2026-01 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0044 | Sheet1!L106 | February | text_date | Date typed as text ("2702/2026") | Verify the date |
| A0045 | Sheet1!L106 | February | odd_date | Missing separator in "2702/2026"; read as 27/02/2026 | Verify the date |
| A0046 | Sheet1!AT106 | September | total_mismatch | Total GH₵ 30.00 ≠ GH₵ 35.00 × 1 = GH₵ 35.00 | The computed total is used; check the receipt if the unit cost or quantity is wrong |
| A0048 | Sheet1!L114 | February | month_mismatch | Date 2023-02-23 is outside its month block; 2026-02 from the block was used | Month block kept as the source of truth; check the original receipt |
| A0050 | Sheet1!B124 | — | duplicate_across_categories | "Funnel" appears under both "Cleaning & Hygiene Supplies" (Sheet1!B64) and "Other" | Kept as two items; merge them on the Items screen if they are the same thing |
| A0051 | Sheet1!AA134 | May | month_mismatch | Petty cash: Date 2026-04-06 is outside its month block; 2026-05 from the block was used | Month block kept as the source of truth |
| A0052 | Sheet1!AU180 | September | month_mismatch | Petty cash: Date 2026-06-07 is outside its month block; 2026-09 from the block was used | Month block kept as the source of truth |
| A0053 | Sheet1!Q183 | March | text_date | Petty cash: Date typed as text ("12-13/03/2026") | Verify the date |
| A0054 | Sheet1!Q183 | March | odd_date | Petty cash: Date range "12-13/03/2026"; the first day (12) was used | Verify the date |
| A0058 | Sheet1!F198 | January | grand_total_mismatch | January: hand-typed grand total GH₵ 6,691.06 ≠ computed sum of imported expenses GH₵ 6,783.06 (difference GH₵ -92.00) | The app always uses the computed total; review skipped or mismatched rows for this month |
| A0060 | Sheet1!F169 | January | petty_cash_mismatch | January: computed closing balance GH₵ -2,297.19 ≠ sheet's last "Balance after cash-out" GH₵ 668.84 | Cash-ins or cash-outs are probably missing from the sheet; reconcile on the Petty Cash screen |
| A0061 | Sheet1!K198 | February | grand_total_mismatch | February: hand-typed grand total GH₵ 2,777.00 ≠ computed sum of imported expenses GH₵ 2,639.27 (difference GH₵ 137.73) | The app always uses the computed total; review skipped or mismatched rows for this month |
| A0063 | Sheet1!K171 | February | petty_cash_mismatch | February: computed closing balance GH₵ -2,950.28 ≠ sheet's last "Balance after cash-out" GH₵ 14.75 | Cash-ins or cash-outs are probably missing from the sheet; reconcile on the Petty Cash screen |
| A0064 | Sheet1!P198 | March | grand_total_mismatch | March: hand-typed grand total GH₵ 8,432.72 ≠ computed sum of imported expenses GH₵ 8,459.72 (difference GH₵ -27.00) | The app always uses the computed total; review skipped or mismatched rows for this month |
| A0066 | Sheet1!P169 | March | petty_cash_mismatch | March: computed closing balance GH₵ -5,391.03 ≠ sheet's last "Balance after cash-out" GH₵ 1,509.21 | Cash-ins or cash-outs are probably missing from the sheet; reconcile on the Petty Cash screen |
| A0068 | Sheet1!U168 | April | petty_cash_mismatch | April: computed closing balance GH₵ -7,218.94 ≠ sheet's last "Balance after cash-out" GH₵ 113.79 | Cash-ins or cash-outs are probably missing from the sheet; reconcile on the Petty Cash screen |
| A0069 | Sheet1!Z198 | May | grand_total_mismatch | May: hand-typed grand total GH₵ 4,376.92 ≠ computed sum of imported expenses GH₵ 5,255.41 (difference GH₵ -878.49) | The app always uses the computed total; review skipped or mismatched rows for this month |
| A0071 | Sheet1!Z173 | May | petty_cash_mismatch | May: computed closing balance GH₵ -8,810.27 ≠ sheet's last "Balance after cash-out" GH₵ 83.82 | Cash-ins or cash-outs are probably missing from the sheet; reconcile on the Petty Cash screen |
| A0072 | Sheet1!AE198 | June | grand_total_mismatch | June: hand-typed grand total GH₵ 8,612.91 ≠ computed sum of imported expenses GH₵ 7,971.42 (difference GH₵ 641.49) | The app always uses the computed total; review skipped or mismatched rows for this month |
| A0075 | Sheet1!AE176 | June | petty_cash_mismatch | June: computed closing balance GH₵ -10,634.15 ≠ sheet's last "Balance after cash-out" GH₵ 145.38 | Cash-ins or cash-outs are probably missing from the sheet; reconcile on the Petty Cash screen |
| A0076 | Sheet1!AT198 | September | grand_total_mismatch | September: hand-typed grand total GH₵ 6,258.50 ≠ computed sum of imported expenses GH₵ 6,206.50 (difference GH₵ 52.00) | The app always uses the computed total; review skipped or mismatched rows for this month |

## Info (19)

| ID | Location | Month | Type | Problem | Suggested action |
|---|---|---|---|---|---|
| A0001 | Sheet1!B12 | — | name_whitespace | Item name "Bottled Water " has extra spaces; stored as "Bottled Water" | No action needed |
| A0007 | Sheet1!B26 | — | name_whitespace | Item name "Electricity " has extra spaces; stored as "Electricity" | No action needed |
| A0016 | Sheet1!A46 | — | category_mapped | Category label "Cleaning & Hygine supplies" mapped to seed category "Cleaning & Hygiene Supplies" | No action needed; fix the label in the sheet if it is a typo |
| A0019 | Sheet1!B50 | — | name_whitespace | Item name "Hand  sanitizer" has extra spaces; stored as "Hand sanitizer" | No action needed |
| A0022 | Sheet1!B56 | — | name_whitespace | Item name "Toilet roll " has extra spaces; stored as "Toilet roll" | No action needed |
| A0028 | Sheet1!B63 | — | name_whitespace | Item name "Water Barrel " has extra spaces; stored as "Water Barrel" | No action needed |
| A0040 | Sheet1!AQ89 | September | amount_format | Unit cost "Ghc Ghc 61": Currency prefix repeated 2 times | Read as GH₵ 61.00; verify |
| A0047 | Sheet1!B112 | — | name_whitespace | Item name "Light Rental " has extra spaces; stored as "Light Rental" | No action needed |
| A0049 | Sheet1!B121 | — | name_whitespace | Item name "Fuel " has extra spaces; stored as "Fuel" | No action needed |
| A0055 | Sheet1!AE189 | June | amount_format | Petty cash amount "Ghc 3, 510": Spaces inside the number | Read as GH₵ 3,510.00; verify |
| A0056 | Sheet1!AT198 | September | amount_format | Grand total "Ghc  6, 258.50": Spaces inside the number | Read as GH₵ 6,258.50; verify |
| A0057 | Sheet1!F162 | January | opening_balance | Opening balance derived as GH₵ 930.25: first "Balance after cash-out" (GH₵ 792.23 on 2026-01-08) plus cash-out minus cash-in recorded up to that date | Confirm it on the Petty Cash screen ("Set opening balance") |
| A0059 | Sheet1!F134 | January | petty_cash_mismatch | January: "Cash used without charges" rows sum to GH₵ 6,691.06 but cash-out rows sum to GH₵ 4,699.41 | Charges were not itemised in the sheet; add charge entries on the Petty Cash screen if known |
| A0062 | Sheet1!K134 | February | petty_cash_mismatch | February: "Cash used without charges" rows sum to GH₵ 2,777.00 but cash-out rows sum to GH₵ 2,653.09 | Charges were not itemised in the sheet; add charge entries on the Petty Cash screen if known |
| A0065 | Sheet1!P134 | March | petty_cash_mismatch | March: "Cash used without charges" rows sum to GH₵ 8,432.72 but cash-out rows sum to GH₵ 3,092.75 | Charges were not itemised in the sheet; add charge entries on the Petty Cash screen if known |
| A0067 | Sheet1!U134 | April | petty_cash_mismatch | April: "Cash used without charges" rows sum to GH₵ 2,013.05 but cash-out rows sum to GH₵ 1,842.43 | Charges were not itemised in the sheet; add charge entries on the Petty Cash screen if known |
| A0070 | Sheet1!Z134 | May | petty_cash_mismatch | May: "Cash used without charges" rows sum to GH₵ 4,376.92 but cash-out rows sum to GH₵ 4,289.47 | Charges were not itemised in the sheet; add charge entries on the Petty Cash screen if known |
| A0073 | Sheet1!AE198 | June | grand_total_mismatch | June: grand total GH₵ 8,612.91 ≠ sum of the "TOTAL (Cash used)" rows GH₵ 8,542.91 | Informational — the hand-typed totals disagree with each other |
| A0074 | Sheet1!AE134 | June | petty_cash_mismatch | June: "Cash used without charges" rows sum to GH₵ 8,542.91 but cash-out rows sum to GH₵ 1,823.88 | Charges were not itemised in the sheet; add charge entries on the Petty Cash screen if known |

