#!/usr/bin/env python3
"""Build the concise, upload-ready SARING synthetic Price Engine notebook."""

from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "saring_price_engine_synthetic_colab.ipynb"


def lines(source: str) -> list[str]:
    return dedent(source).strip().splitlines(keepends=True)


def markdown(source: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": lines(source)}


def code(source: str) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": lines(source),
    }


cells = [
    markdown(
        """
        # SARING Price Engine — Synthetic Colab

        A single Run all workflow for developing a conditional laptop-price interval.

        **Flow:** upload → contract checks → staged EDA → chronological split →
        transparent cohort baseline → Quantile LightGBM → CatBoost challenger →
        untouched final-test evaluation → evidence-shaped output → artifact ZIP.

        The model estimates Q10, Q50, and Q90. A quote above Q90 is a review signal,
        not fraud probability or state loss. The supplied observations are synthetic,
        so this notebook validates the pipeline rather than real-market accuracy.
        """
    ),
    code(
        """
        # Colab installs these once, then continues automatically.
        %pip install -q lightgbm==4.7.0 catboost==1.2.10
        """
    ),
    code(
        """
        from __future__ import annotations

        import hashlib, importlib.metadata, json, math, platform, shutil, time, warnings
        from pathlib import Path

        import joblib
        import lightgbm as lgb
        import matplotlib.pyplot as plt
        import numpy as np
        import pandas as pd
        import seaborn as sns
        from catboost import CatBoostRegressor
        from sklearn.metrics import mean_absolute_error, mean_pinball_loss

        warnings.filterwarnings("ignore", category=FutureWarning)
        pd.set_option("display.max_columns", 120)
        sns.set_theme(style="whitegrid", context="notebook")

        SEED = 20260808
        QUANTILES = (0.10, 0.50, 0.90)
        MIN_COMPARATORS = 8
        TEST_FRACTION = 0.20
        VALIDATION_FRACTION_OF_PRETEST = 0.20
        DATA_MODE = "UPLOAD"  # UPLOAD, DRIVE, or PATH
        DATA_PATH = "/content/price_training_observed_synthetic.csv.gz"
        DRIVE_PATH = "/content/drive/MyDrive/SARING/price_training_observed_synthetic.csv.gz"
        ARTIFACT_DIR = Path("/content/saring_price_engine_artifacts")
        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        np.random.seed(SEED)

        print({"python": platform.python_version(), "lightgbm": lgb.__version__, "mode": DATA_MODE})
        """
    ),
    markdown(
        """
        ## 1. Load and prove the contract

        Upload **price_training_observed_synthetic.csv.gz** when prompted. This
        first gate proves identity, timestamp validity, positive price, synthetic
        provenance, and the absence of post-cutoff observations before EDA or training.
        """
    ),
    code(
        """
        def resolve_path() -> Path:
            if DATA_MODE == "UPLOAD":
                from google.colab import files
                uploaded = files.upload()
                candidates = [Path("/content") / name for name in uploaded if name.endswith((".csv", ".csv.gz"))]
                if len(candidates) != 1:
                    raise ValueError("Upload exactly one CSV or CSV.GZ dataset.")
                return candidates[0]
            if DATA_MODE == "DRIVE":
                from google.colab import drive
                drive.mount("/content/drive")
                return Path(DRIVE_PATH)
            if DATA_MODE == "PATH":
                return Path(DATA_PATH)
            raise ValueError("DATA_MODE must be UPLOAD, DRIVE, or PATH.")


        REQUIRED = {
            "record_id", "unit_price", "observed_at", "analysis_cutoff_at",
            "manufacturer_part_number", "brand", "model_name", "cpu", "ram_gb",
            "storage_gb", "quantity", "unit", "currency", "tax_included",
            "shipping_included", "installation_included", "warranty_months",
            "region_code", "service_bundle", "is_synthetic",
        }
        FORBIDDEN_TOKENS = (
            "winner", "award", "evaluation", "fraud", "collusion", "contract",
            "payment", "state_loss", "scenario_label", "review_label",
        )
        NUMERIC = [
            "unit_price", "ram_gb", "storage_gb", "display_size_inch", "quantity",
            "warranty_months", "delivery_days", "cpu_cores", "cpu_threads",
        ]
        CATEGORICAL = [
            "manufacturer_part_number", "brand", "model_name", "cpu", "cpu_family",
            "cpu_generation", "ram_type", "storage_type", "display_resolution",
            "display_panel", "operating_system", "condition", "tax_included",
            "shipping_included", "installation_included", "region_code",
            "region_group", "service_bundle", "seller_tier",
        ]

        SOURCE_PATH = resolve_path()
        SOURCE_SHA256 = hashlib.sha256(SOURCE_PATH.read_bytes()).hexdigest()
        raw = pd.read_csv(SOURCE_PATH, low_memory=False, keep_default_na=False)
        missing_columns = REQUIRED - set(raw.columns)
        suspicious_columns = [c for c in raw if any(t in c.lower() for t in FORBIDDEN_TOKENS)]
        if missing_columns or suspicious_columns:
            raise ValueError({"missing_required": sorted(missing_columns), "forbidden": suspicious_columns})

        df = raw.copy()
        df["observed_at"] = pd.to_datetime(df["observed_at"], errors="coerce", utc=True)
        df["analysis_cutoff_at"] = pd.to_datetime(df["analysis_cutoff_at"], errors="coerce", utc=True)
        for column in NUMERIC:
            df[column] = pd.to_numeric(df.get(column), errors="coerce")
        for column in CATEGORICAL + ["unit", "currency"]:
            df[column] = df.get(column, "").astype("string").str.strip()
            df.loc[df[column].str.upper().isin(["", "UNKNOWN", "N/A", "NULL"]), column] = pd.NA

        invalid = (
            df["record_id"].duplicated()
            | df["unit_price"].isna() | df["unit_price"].le(0)
            | df["observed_at"].isna()
            | df["analysis_cutoff_at"].isna()
            | df["observed_at"].gt(df["analysis_cutoff_at"])
        )
        if invalid.any() or not df["is_synthetic"].astype(str).str.upper().eq("TRUE").all():
            raise ValueError(f"Contract gate failed for {int(invalid.sum())} rows.")

        df["observed_month"] = df["observed_at"].dt.month.astype(float)
        df["time_days"] = (df["observed_at"] - df["observed_at"].min()).dt.total_seconds() / 86400
        print({"file": SOURCE_PATH.name, "sha256": SOURCE_SHA256, "rows": len(df), "columns": len(df.columns)})
        display(df.head(3))
        """
    ),
    markdown(
        """
        ## 2. EDA storyline

        The EDA answers four questions in order:

        1. **Coverage:** what period, products, regions, and sources exist?
        2. **Target behavior:** how wide and how time-dependent is price?
        3. **Comparability:** are repeated SKU cohorts and commercial bases sufficient?
        4. **Evaluation readiness:** do chronological windows retain comparable coverage?

        Test data is inspected only for drift and is never used to fit preprocessing,
        price trend, early stopping, or model selection.
        """
    ),
    code(
        """
        scope = pd.Series({
            "rows": len(df),
            "date_start": df["observed_at"].min(),
            "date_end": df["observed_at"].max(),
            "months": df["observed_at"].dt.strftime("%Y-%m").nunique(),
            "brands": df["brand"].nunique(),
            "models": df["model_name"].nunique(),
            "skus": df["manufacturer_part_number"].nunique(),
            "regions": df["region_code"].nunique(),
            "median_price_idr": df["unit_price"].median(),
        }, name="value")
        display(scope.to_frame())

        monthly = (
            df.set_index("observed_at")["unit_price"].resample("MS")
            .agg(rows="size", p10=lambda s: s.quantile(.10), median="median", p90=lambda s: s.quantile(.90))
            .reset_index()
        )
        fig, axes = plt.subplots(1, 2, figsize=(15, 4.5))
        sns.histplot(df["unit_price"], bins=45, ax=axes[0], color="#2563EB")
        axes[0].set(xscale="log", title="Price distribution (log scale)", xlabel="Observed unit price (IDR)")
        axes[1].fill_between(monthly["observed_at"], monthly["p10"], monthly["p90"], alpha=.18, color="#2563EB", label="P10–P90")
        axes[1].plot(monthly["observed_at"], monthly["median"], color="#111827", label="Median")
        axes[1].set(title="Monthly price level and spread", xlabel="", ylabel="IDR")
        axes[1].legend()
        plt.tight_layout(); plt.show()
        """
    ),
    code(
        """
        sku_counts = df.groupby("manufacturer_part_number", dropna=False).size()
        context_fields = [
            "manufacturer_part_number", "cpu", "ram_gb", "storage_gb",
            "tax_included", "shipping_included", "installation_included",
            "warranty_months", "region_code", "service_bundle",
        ]
        completeness = (1 - df[context_fields].isna().mean()).sort_values()
        spec_price = df.pivot_table(index="ram_gb", columns="storage_gb", values="unit_price", aggfunc="median")

        fig, axes = plt.subplots(1, 3, figsize=(18, 4.6))
        sns.histplot(sku_counts, bins=20, ax=axes[0], color="#0F766E")
        axes[0].axvline(MIN_COMPARATORS, color="#DC2626", linestyle="--")
        axes[0].set(title="Repeated observations per SKU", xlabel="Rows per SKU")
        completeness.plot.barh(ax=axes[1], color="#D97706")
        axes[1].set(title="Commercial/spec completeness", xlabel="Known fraction", xlim=(0, 1))
        sns.heatmap(spec_price / 1e6, annot=True, fmt=".1f", cmap="YlGnBu", ax=axes[2])
        axes[2].set(title="Median price by RAM/storage (Rp million)", xlabel="Storage GB", ylabel="RAM GB")
        plt.tight_layout(); plt.show()

        print({
            "minimum_rows_per_known_sku": int(sku_counts.min()),
            "skus_below_minimum": int(sku_counts.lt(MIN_COMPARATORS).sum()),
            "core_completeness_min": float(completeness.min()),
        })
        """
    ),
    markdown(
        """
        ## 3. Chronological split and train-only price trend

        The newest 20% is the untouched final test. The newest 20% of the remaining
        window is validation. A log-linear market/lifecycle trend is fitted only on
        monthly training medians; models learn the remaining conditional price.
        """
    ),
    code(
        """
        ordered = df.sort_values(["observed_at", "record_id"]).index
        test_start = int(len(ordered) * (1 - TEST_FRACTION))
        pretest, test_idx = ordered[:test_start], ordered[test_start:]
        valid_start = int(len(pretest) * (1 - VALIDATION_FRACTION_OF_PRETEST))
        train_idx, valid_idx = pretest[:valid_start], pretest[valid_start:]
        train_df, valid_df, test_df = (df.loc[idx].copy() for idx in (train_idx, valid_idx, test_idx))

        trend = (
            train_df.assign(month=train_df["observed_at"].dt.strftime("%Y-%m"))
            .groupby("month").agg(time_days=("time_days", "median"), median_price=("unit_price", "median"))
        )
        TREND_SLOPE = float(np.polyfit(trend["time_days"], np.log(trend["median_price"]), 1)[0])
        TREND_BASE_DAY = float(train_df["time_days"].max())

        for frame in (train_df, valid_df, test_df):
            frame["price_index"] = np.exp(TREND_SLOPE * (frame["time_days"] - TREND_BASE_DAY))
            frame["real_unit_price"] = frame["unit_price"] / frame["price_index"]

        split_summary = pd.DataFrame({
            "split": ["train", "validation", "final_test"],
            "rows": [len(train_df), len(valid_df), len(test_df)],
            "date_min": [x["observed_at"].min() for x in (train_df, valid_df, test_df)],
            "date_max": [x["observed_at"].max() for x in (train_df, valid_df, test_df)],
            "median_price": [x["unit_price"].median() for x in (train_df, valid_df, test_df)],
            "known_skus": [x["manufacturer_part_number"].nunique() for x in (train_df, valid_df, test_df)],
        })
        display(split_summary)

        plot_split = pd.concat([
            x.assign(split=name) for name, x in
            [("train", train_df), ("validation", valid_df), ("final_test", test_df)]
        ])
        plt.figure(figsize=(10, 4.5))
        sns.boxplot(data=plot_split, x="split", y="unit_price", showfliers=False)
        plt.yscale("log"); plt.title("Chronological target drift"); plt.ylabel("Unit price (IDR, log scale)")
        plt.show()
        print({"train_only_annualized_price_trend": math.exp(TREND_SLOPE * 365.25) - 1})
        """
    ),
    markdown(
        """
        ## 4. Comparable-cohort baseline

        The transparent baseline tries exact SKU first, then a strict configuration.
        It supplies comparator count and Q10/Q50/Q90 without a learned model.
        """
    ),
    code(
        """
        COHORT_LEVELS = [
            ("EXACT_SKU", ["manufacturer_part_number"]),
            ("STRICT_CONFIGURATION", ["brand", "cpu", "ram_gb", "storage_gb", "condition"]),
        ]

        def key(row, columns):
            values = tuple(None if pd.isna(row[c]) else str(row[c]).strip().lower() for c in columns)
            return None if any(v is None for v in values) else values

        def cohort_maps(reference):
            maps = {}
            for level, columns in COHORT_LEVELS:
                groups = {}
                for _, row in reference.iterrows():
                    k = key(row, columns)
                    if k is not None:
                        groups.setdefault(k, []).append(float(row["unit_price"]))
                maps[level] = (columns, groups)
            return maps

        COHORT_MAPS = cohort_maps(train_df)

        def cohort_predict(frame):
            result = []
            for _, row in frame.iterrows():
                best = ("NONE", [])
                for level, (columns, groups) in COHORT_MAPS.items():
                    prices = groups.get(key(row, columns), [])
                    if len(prices) > len(best[1]):
                        best = (level, prices)
                    if len(prices) >= MIN_COMPARATORS:
                        best = (level, prices); break
                level, prices = best
                sufficient = len(prices) >= MIN_COMPARATORS
                result.append({
                    "cohort_level": level, "comparator_count": len(prices), "cohort_sufficient": sufficient,
                    **{f"q{int(q*100)}": np.quantile(prices, q) if sufficient else np.nan for q in QUANTILES},
                })
            return pd.DataFrame(result, index=frame.index)

        baseline_valid, baseline_test = cohort_predict(valid_df), cohort_predict(test_df)
        display(pd.concat([
            baseline_valid.assign(split="validation"),
            baseline_test.assign(split="final_test"),
        ]).groupby(["split", "cohort_level"]).agg(rows=("cohort_level", "size"), sufficient=("cohort_sufficient", "mean")))
        """
    ),
    markdown(
        """
        ## 5. Two quantile models, one preprocessing contract

        LightGBM is primary. CatBoost is the only challenger. Both use the same
        train/validation/test rows, features, log target, and quantiles.
        """
    ),
    code(
        """
        NUMERIC_FEATURES = [
            "cpu_cores", "cpu_threads", "ram_gb", "storage_gb", "display_size_inch",
            "quantity", "warranty_months", "delivery_days", "observed_month",
        ]
        CATEGORICAL_FEATURES = CATEGORICAL
        FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

        numeric_medians = {c: float(train_df[c].median()) for c in NUMERIC_FEATURES}
        category_levels = {
            c: sorted(set(train_df[c].astype("string").fillna("__MISSING__")) | {"__MISSING__", "__UNKNOWN__"})
            for c in CATEGORICAL_FEATURES
        }

        def transform(frame, engine):
            out = pd.DataFrame(index=frame.index)
            for c in NUMERIC_FEATURES:
                out[c] = pd.to_numeric(frame[c], errors="coerce").fillna(numeric_medians[c]).astype(float)
            for c in CATEGORICAL_FEATURES:
                values = frame[c].astype("string").fillna("__MISSING__")
                if engine == "lightgbm":
                    values = values.where(values.isin(category_levels[c]), "__UNKNOWN__")
                    out[c] = pd.Categorical(values, categories=category_levels[c])
                else:
                    out[c] = values.astype(str)
            return out[FEATURES]

        X = {
            engine: {name: transform(frame, engine) for name, frame in
                     [("train", train_df), ("validation", valid_df), ("test", test_df)]}
            for engine in ("lightgbm", "catboost")
        }
        y_train = np.log1p(train_df["real_unit_price"])
        y_valid = np.log1p(valid_df["real_unit_price"])
        cat_indices = [FEATURES.index(c) for c in CATEGORICAL_FEATURES]
        """
    ),
    code(
        """
        def fit_lightgbm():
            models, started = {}, time.perf_counter()
            for q in QUANTILES:
                model = lgb.LGBMRegressor(
                    objective="quantile", alpha=q, n_estimators=2500, learning_rate=.035,
                    num_leaves=31, min_child_samples=35, subsample=.9, subsample_freq=1,
                    colsample_bytree=.9, reg_lambda=1, random_state=SEED, n_jobs=-1, verbosity=-1,
                )
                model.fit(
                    X["lightgbm"]["train"], y_train,
                    eval_set=[(X["lightgbm"]["validation"], y_valid)], eval_metric="quantile",
                    categorical_feature=CATEGORICAL_FEATURES,
                    callbacks=[lgb.early_stopping(150, verbose=False), lgb.log_evaluation(0)],
                )
                models[q] = model
            return models, time.perf_counter() - started

        def fit_catboost():
            models, started = {}, time.perf_counter()
            for q in QUANTILES:
                model = CatBoostRegressor(
                    loss_function=f"Quantile:alpha={q}", eval_metric=f"Quantile:alpha={q}",
                    iterations=2000, depth=8, learning_rate=.045, l2_leaf_reg=5,
                    random_seed=SEED, allow_writing_files=False, verbose=False, thread_count=-1,
                )
                model.fit(
                    X["catboost"]["train"], y_train, cat_features=cat_indices,
                    eval_set=(X["catboost"]["validation"], y_valid),
                    early_stopping_rounds=150, verbose=250,
                )
                models[q] = model
            return models, time.perf_counter() - started

        lgb_models, lgb_seconds = fit_lightgbm()
        cat_models, cat_seconds = fit_catboost()
        print({"lightgbm_seconds": lgb_seconds, "catboost_seconds": cat_seconds})
        """
    ),
    markdown(
        """
        ## 6. Evaluation and selection

        Validation chooses the model. Final test is opened once afterward. Required
        metrics are pinball loss per quantile, Q90 coverage, Q10–Q90 coverage,
        median MAE, normalized interval width, and raw crossing rate.
        """
    ),
    code(
        """
        MODELS = {"lightgbm_quantile": lgb_models, "catboost_quantile": cat_models}
        ENGINE = {"lightgbm_quantile": "lightgbm", "catboost_quantile": "catboost"}

        def predict(model_name, split, frame):
            raw_real = np.column_stack([
                np.expm1(MODELS[model_name][q].predict(X[ENGINE[model_name]][split]))
                for q in QUANTILES
            ])
            raw = raw_real * frame["price_index"].to_numpy()[:, None]
            crossing = np.mean((raw[:, 0] > raw[:, 1]) | (raw[:, 1] > raw[:, 2]))
            return np.sort(np.maximum(raw, 0), axis=1), float(crossing)

        def metric_row(name, frame, prediction, crossing):
            actual, q10, q50, q90 = frame["unit_price"].to_numpy(), *prediction.T
            return {
                "model": name, "rows": len(frame),
                "pinball_q10": mean_pinball_loss(actual, q10, alpha=.10),
                "pinball_q50": mean_pinball_loss(actual, q50, alpha=.50),
                "pinball_q90": mean_pinball_loss(actual, q90, alpha=.90),
                "median_mae": mean_absolute_error(actual, q50),
                "q90_coverage": np.mean(actual <= q90),
                "interval_coverage": np.mean((actual >= q10) & (actual <= q90)),
                "normalized_width": np.mean(q90 - q10) / np.median(actual),
                "crossing_rate_raw": crossing,
            }

        predictions = {}
        validation_rows = []
        for name in MODELS:
            predictions[(name, "validation")], crossing = predict(name, "validation", valid_df)
            validation_rows.append(metric_row(name, valid_df, predictions[(name, "validation")], crossing))

        baseline_valid_array = baseline_valid[["q10", "q50", "q90"]].to_numpy()
        valid_mask = baseline_valid["cohort_sufficient"].to_numpy()
        validation_rows.append(metric_row(
            "cohort_baseline", valid_df.loc[valid_mask], baseline_valid_array[valid_mask], 0,
        ))
        validation_metrics = pd.DataFrame(validation_rows).set_index("model")
        validation_metrics["selection_score"] = (
            validation_metrics[["pinball_q10", "pinball_q50", "pinball_q90"]].sum(axis=1)
            / valid_df["unit_price"].median()
            + (validation_metrics["q90_coverage"] - .90).abs()
            + (validation_metrics["interval_coverage"] - .80).abs()
        )
        SELECTED_MODEL = validation_metrics["selection_score"].idxmin()
        display(validation_metrics.sort_values("selection_score"))
        print("Selected on validation:", SELECTED_MODEL)
        """
    ),
    code(
        """
        test_rows = []
        for name in MODELS:
            predictions[(name, "test")], crossing = predict(name, "test", test_df)
            test_rows.append(metric_row(name, test_df, predictions[(name, "test")], crossing))

        baseline_test_array = baseline_test[["q10", "q50", "q90"]].to_numpy()
        test_mask = baseline_test["cohort_sufficient"].to_numpy()
        test_rows.append(metric_row("cohort_baseline", test_df.loc[test_mask], baseline_test_array[test_mask], 0))
        test_metrics = pd.DataFrame(test_rows).set_index("model")
        display(test_metrics)

        selected_prediction = (
            baseline_test_array if SELECTED_MODEL == "cohort_baseline"
            else predictions[(SELECTED_MODEL, "test")]
        )
        calibration = pd.DataFrame({
            "quantile": QUANTILES,
            "expected": QUANTILES,
            "empirical": [(test_df["unit_price"].to_numpy() <= selected_prediction[:, i]).mean() for i in range(3)],
        })
        calibrated = (
            abs(calibration.loc[calibration["quantile"].eq(.90), "empirical"].iloc[0] - .90) <= .05
            and abs(
                np.mean(
                    (test_df["unit_price"].to_numpy() >= selected_prediction[:, 0])
                    & (test_df["unit_price"].to_numpy() <= selected_prediction[:, 2])
                ) - .80
            ) <= .05
        )

        fig, axes = plt.subplots(1, 2, figsize=(13, 4.5))
        axes[0].plot(calibration["expected"], calibration["empirical"], marker="o", linewidth=2)
        axes[0].plot([0, 1], [0, 1], "--", color="#6B7280")
        axes[0].set(title=f"Final-test calibration — {SELECTED_MODEL}", xlabel="Expected CDF", ylabel="Empirical CDF", xlim=(0, 1), ylim=(0, 1))

        bands = pd.qcut(test_df["unit_price"], 4, duplicates="drop")
        band_coverage = pd.DataFrame({"band": bands, "actual": test_df["unit_price"], "q90": selected_prediction[:, 2]}).groupby("band", observed=True).apply(lambda g: (g["actual"] <= g["q90"]).mean())
        band_coverage.plot.bar(ax=axes[1], color="#D97706")
        axes[1].axhline(.90, linestyle="--", color="#111827")
        axes[1].set(title="Q90 coverage by price band", xlabel="", ylabel="Coverage", ylim=(0, 1))
        plt.tight_layout(); plt.show()
        display(calibration)
        print("Calibration gate:", "PASS" if calibrated else "FAIL")
        """
    ),
    code(
        """
        if SELECTED_MODEL == "cohort_baseline":
            importance = pd.Series(dtype=float)
        elif SELECTED_MODEL == "catboost_quantile":
            importance = pd.Series(cat_models[.50].get_feature_importance(), index=FEATURES)
        else:
            importance = pd.Series(
                lgb_models[.50].booster_.feature_importance(importance_type="gain"),
                index=FEATURES,
            )
        if not importance.empty:
            top = importance.sort_values().tail(15)
            top.plot.barh(figsize=(9, 5), color="#0F766E", title="Q50 feature importance")
            plt.xlabel("Model importance (not causal effect)"); plt.tight_layout(); plt.show()
            display(top.sort_values(ascending=False).rename("importance").to_frame())
        """
    ),
    markdown(
        """
        ## 7. Evidence-shaped scoring

        The example below mirrors the web contract: status, cohort, comparator
        count, Q10/Q50/Q90, deviation above Q90, exposure, confidence diagnostics,
        alternative explanations, and the source record.
        """
    ),
    code(
        """
        def known(value):
            return not pd.isna(value) and str(value).strip().upper() not in {"", "UNKNOWN", "N/A", "NULL"}

        def score_position(position: int) -> dict:
            row = test_df.iloc[position]
            cohort = baseline_test.iloc[position]
            reasons = []
            if not cohort["cohort_sufficient"]:
                reasons.append("insufficient comparable cohort")
            if not known(row["manufacturer_part_number"]) and sum(known(row[c]) for c in ["brand", "cpu", "ram_gb", "storage_gb"]) < 3:
                reasons.append("unresolved SKU/specification")
            for field in ["unit", "currency", "tax_included", "shipping_included", "warranty_months"]:
                if not known(row[field]):
                    reasons.append(f"unknown {field}")
            if not calibrated:
                reasons.append("final-test interval is not calibrated")
            if reasons:
                return {"status": "ABSTAINED", "abstention_reason": "; ".join(reasons)}

            q10, q50, q90 = selected_prediction[position]
            quote, quantity = float(row["unit_price"]), float(row["quantity"])
            relative_width = (q90 - q10) / max(q50, 1)
            confidence = min(1, cohort["comparator_count"] / 30) * math.exp(-relative_width)
            return {
                "status": "SCORED", "model": SELECTED_MODEL,
                "source_record_id": row["record_id"], "cohort_level": cohort["cohort_level"],
                "comparator_count": int(cohort["comparator_count"]),
                "q10": q10, "q50": q50, "q90": q90, "quoted_unit_price": quote,
                "relative_deviation": max(0, (quote - q90) / q90),
                "estimated_exposure_requiring_verification": quantity * max(0, quote - q90),
                "confidence": confidence,
                "confidence_note": "Diagnostic synthetic confidence; not a calibrated probability.",
                "alternative_explanations": [
                    "longer warranty", "installation/configuration", "remote shipping",
                    "urgent delivery", "tax basis mismatch", "bundled software/service",
                ],
            }

        required_context = [
            "unit", "currency", "tax_included", "shipping_included", "warranty_months",
        ]
        eligible_position = next(
            i for i in range(len(test_df))
            if baseline_test.iloc[i]["cohort_sufficient"]
            and all(known(test_df.iloc[i][field]) for field in required_context)
        )
        example_result = score_position(eligible_position)
        display(pd.Series(example_result, name="value").to_frame())
        """
    ),
    markdown(
        """
        ## 8. Export reproducible artifacts

        The ZIP contains both model families, preprocessing metadata, validation
        and final-test metrics, final-test predictions, calibration, source hash,
        and a model card.
        """
    ),
    code(
        """
        for q, model in lgb_models.items():
            joblib.dump(model, ARTIFACT_DIR / f"lightgbm_q{int(q*100)}.joblib")
        for q, model in cat_models.items():
            model.save_model(str(ARTIFACT_DIR / f"catboost_q{int(q*100)}.cbm"))

        evidence = test_df[[
            "record_id", "observed_at", "manufacturer_part_number", "brand",
            "model_name", "unit_price", "quantity", "region_code",
        ]].reset_index(drop=True)
        evidence[["q10", "q50", "q90"]] = selected_prediction
        evidence["relative_deviation"] = np.maximum(0, (evidence["unit_price"] - evidence["q90"]) / evidence["q90"])
        evidence["exposure_requiring_verification"] = evidence["quantity"] * np.maximum(0, evidence["unit_price"] - evidence["q90"])
        evidence.to_csv(ARTIFACT_DIR / "final_test_price_evidence.csv", index=False)
        validation_metrics.to_csv(ARTIFACT_DIR / "validation_metrics.csv")
        test_metrics.to_csv(ARTIFACT_DIR / "final_test_metrics.csv")
        calibration.to_csv(ARTIFACT_DIR / "final_test_calibration.csv", index=False)

        metadata = {
            "source_file": SOURCE_PATH.name, "source_sha256": SOURCE_SHA256,
            "selected_model": SELECTED_MODEL, "quantiles": QUANTILES,
            "features": FEATURES, "numeric_medians": numeric_medians,
            "category_levels": category_levels, "trend_slope_per_day": TREND_SLOPE,
            "trend_base_day": TREND_BASE_DAY, "minimum_comparators": MIN_COMPARATORS,
            "calibration_gate_passed": calibrated,
            "purpose": "Conditional laptop price interval for review prioritization.",
            "prohibited_claims": ["fraud probability", "state loss", "automated procurement decision"],
            "versions": {
                p: importlib.metadata.version(p)
                for p in ["lightgbm", "catboost", "pandas", "numpy", "scikit-learn", "joblib"]
            },
        }
        (ARTIFACT_DIR / "model_card.json").write_text(json.dumps(metadata, indent=2, default=str))
        archive = shutil.make_archive("/content/saring_price_engine_artifacts", "zip", ARTIFACT_DIR)
        print("Created:", archive)
        from google.colab import files
        files.download(archive)
        """
    ),
    markdown(
        """
        ## Interpretation checklist

        - Model selection used validation only; final test remained untouched.
        - Prefer a learned model only if it beats the cohort baseline without
          damaging Q90 and Q10–Q90 coverage.
        - Feature importance is descriptive, not causal.
        - ABSTAIN when comparability, commercial basis, or calibration is insufficient.
        - Synthetic success proves code behavior only. Production requires licensed,
          source-linked observations and external temporal/category validation.
        """
    ),
]


notebook = {
    "cells": cells,
    "metadata": {
        "accelerator": "CPU",
        "colab": {"name": OUTPUT.name, "provenance": []},
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.x"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}
OUTPUT.write_text(json.dumps(notebook, indent=1) + "\n", encoding="utf-8")
print(OUTPUT)
