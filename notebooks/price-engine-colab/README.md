# SARING Price Engine — Google Colab

For the prepared synthetic run:

1. upload `saring_price_engine_synthetic_colab.ipynb` to Google Colab;
2. select **Runtime → Run all**;
3. upload `data/price_training_observed_synthetic.csv.gz` when prompted.

The notebook trains Quantile LightGBM Q10/Q50/Q90 and CatBoost Quantile
Q10/Q50/Q90 as the alternative model. It includes staged EDA, a transparent
cohort baseline, chronological validation, calibration checks, and
evidence-shaped output. Dataset sources, assumptions, and validation are
documented in `data/README.md`.

## Input

Default mode asks you to upload one observed-price table:

- recommended file: `price_training_observed.csv.gz`;
- accepted formats: CSV, CSV.GZ, or Parquet;
- minimum required fields (aliases are supported): unit price and observation timestamp;
- useful comparability fields: part number/SKU, brand, model, CPU, RAM, storage, condition, quantity, unit, currency, tax, shipping, installation, warranty, region, and service bundle.

The notebook can also read from Google Drive or a fixed Colab path. Change `DATA_MODE` and its path variables in the configuration cell.

Do not use controlled scenario targets, labels, winner/award/evaluation outcome, contract, payment, or post-cutoff fields as model features.

## What it produces

- comparable-cohort median/Q90 baseline;
- LightGBM quantile Q50 and Q90 models;
- optional CatBoost quantile challenger;
- chronological train/validation/final out-of-time split and product-disjoint stress test;
- pinball loss, Q90 coverage, calibration slices, training time, and model-selection report;
- explicit operational abstention gates;
- an explicit fallback to the transparent cohort baseline when a learned model does not improve validation quality by at least 2%;
- a ZIP containing models, preprocessing metadata, predictions, metrics, source hash, resolved versions, and model card.

The exported model is an experiment until its interval calibration, comparator quality, source locators, and category/time coverage pass production gates. It must not be described as fraud probability, state loss, or an automated procurement decision.
