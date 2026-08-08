# Grounded synthetic Price Engine dataset

This directory contains a deterministic synthetic dataset for running the SARING Price Engine notebook end to end.

## Run it in Colab

1. Open `../saring_price_engine_training.ipynb` in Google Colab.
2. Keep `DATA_MODE = "UPLOAD"`.
3. Choose `price_training_observed_synthetic.csv.gz` when the upload prompt appears.
4. Run all cells.

The training file is only 346 KB compressed, so the Colab upload is immediate.

If the workspace also contains `price_training_synthetic.csv.gz`, treat it as an alternate panel. The recommended file for this grounded, provenance-rich workflow is specifically `price_training_observed_synthetic.csv.gz`; it includes controlled missingness, an isolated generation-truth table, a source registry, and the validation/run reports documented below.

## Files

| File | Use |
|---|---|
| `price_training_observed_synthetic.csv.gz` | Upload this to the notebook. It contains 12,040 observed-style synthetic rows. |
| `product_catalog.csv` | Forty grounded synthetic configurations across four business-laptop families. |
| `source_registry.json` | Public primary sources and the exact role each source plays. |
| `generation_assumptions.json` | Every synthetic coefficient, missingness rate, and scenario assumption. |
| `validation_report.json` | Row counts, ranges, hashes, temporal checks, split coverage, and leakage checks. |
| `notebook_run_report.json` | Recorded full Run All metrics on the generated dataset. |
| `generation_truth_do_not_train.csv.gz` | Latent DGP components for controlled evaluation. Never upload this as training data. |
| `generate_synthetic_price_data.py` | Dependency-free deterministic builder. |

## What is internet-grounded

- Lenovo ThinkPad T14 Gen 4 and ThinkBook 14 Gen 4 configuration families;
- Dell Latitude 5440 processor/display family;
- HP ProBook 440 G10 memory/display family;
- Indonesian laptop price scale from Acer Official Store Indonesia;
- the 11% VAT context effective from 1 April 2022 from DJP;
- temporal price context from BPS CPI material;
- imported-component currency context from Bank Indonesia's JISDOR methodology.

The public sources do **not** claim that the generated rows or prices occurred. Product identifiers beginning with `SYN-`, sellers, dates, regions, quantities, services, and all unit prices are generated.

## Design properties

- fixed seed `20260808` and byte-reproducible gzip output;
- 12,040 rows from January 2023 through July 2026;
- 40 product configurations, 11 regions, 96 fictional sellers, and several service/warranty contexts;
- exact-SKU and configuration cohorts remain available across train, validation, and final out-of-time test windows;
- tax, shipping, installation, warranty, quantity, region, time, seller tier, and service bundle influence the DGP;
- controlled missingness exercises operational abstention;
- controlled benign premiums and promotional discounts live only in the separate truth file;
- no winner, award, evaluation, fraud, contract, payment, or scenario label appears in the training export;
- every row is explicitly marked synthetic.

## Verified full run

The final dataset was executed through every notebook cell. The selected CatBoost model reached 91.61% Q90 coverage on the untouched final out-of-time test, inside the configured 90% ± 5 percentage-point gate. The exact metrics are in `notebook_run_report.json`.

The selected model did not pass product-disjoint calibration (67.68% Q90 coverage). This is retained as an explicit limitation: the notebook abstains for a previously unseen product identifier when that stress gate fails. It must not be presented as evidence that the model generalizes to arbitrary new laptop families.

## Rebuild

From the repository root:

```bash
python3 notebooks/price-engine-colab/data/generate_synthetic_price_data.py
```

The generator exits nonzero if any required validation gate fails. Compare the output hash against `validation_report.json`.

## Appropriate use

Use this dataset for pipeline testing, model comparison, calibration exercises, negative controls, abstention behavior, and reproducibility demonstrations. Do not use it to claim real Indonesian market accuracy, real procurement prevalence, fraud probability, state loss, or production readiness. A production model still requires authorized observed price records with resolvable evidence locators.
