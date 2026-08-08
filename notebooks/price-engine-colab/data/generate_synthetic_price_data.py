#!/usr/bin/env python3
"""Build deterministic, internet-grounded synthetic laptop price observations.

The generated prices are synthetic. Public sources ground compatible product
configurations, Indonesian tax context, temporal context, and price scale only.
They are not copied or represented as real procurement observations.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import random
from calendar import monthrange
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import mean, median
from typing import Any


GENERATOR_VERSION = "1.0.0"
SCHEMA_VERSION = "saring-synthetic-price-training-1.0.0"
DEFAULT_SEED = 20260808
OBSERVATIONS_PER_SKU_MONTH = 7
START_MONTH = (2023, 1)
END_MONTH = (2026, 7)


SOURCES: list[dict[str, Any]] = [
    {
        "source_id": "LENOVO_T14_G4_PSREF",
        "publisher": "Lenovo",
        "title": "ThinkPad T14 Gen 4 (Intel) Product Specifications Reference",
        "url": "https://psref.lenovo.com/syspool/Sys/PDF/ThinkPad/ThinkPad_T14_Gen_4_Intel/ThinkPad_T14_Gen_4_Intel_Spec.PDF",
        "role": "Product-family CPU, memory, storage, display, and operating-system compatibility grounding",
        "price_role": "NONE",
    },
    {
        "source_id": "LENOVO_THINKBOOK14_G4",
        "publisher": "Lenovo Indonesia",
        "title": "ThinkBook 14 Gen 4 (14-inch Intel)",
        "url": "https://www.lenovo.com/id/id/p/laptops/thinkbook/thinkbook-series/thinkbook-14-gen-4-14-inch-intel/len101b0012",
        "role": "Product-family processor, memory, storage, display, and Windows configuration grounding",
        "price_role": "NONE",
    },
    {
        "source_id": "DELL_LATITUDE5440_PROCESSOR",
        "publisher": "Dell",
        "title": "Latitude 5440 Owner's Manual - Processor",
        "url": "https://www.dell.com/support/manuals/en-us/latitude-14-5440-laptop/latitude-5440-owners-manual/processor?guid=guid-ad7c8a38-3bb0-4679-9294-ddea65ea6f71&lang=en-us",
        "role": "Latitude 5440 processor compatibility grounding",
        "price_role": "NONE",
    },
    {
        "source_id": "DELL_LATITUDE5440_DISPLAY",
        "publisher": "Dell",
        "title": "Latitude 5440 Owner's Manual - Display",
        "url": "https://www.dell.com/support/manuals/en-us/latitude-14-5440-laptop/latitude-5440-owners-manual/display?guid=guid-5579fc11-9b22-44fa-ba0d-ae67ba34e9f8&lang=en-us",
        "role": "Latitude 5440 14-inch FHD display grounding",
        "price_role": "NONE",
    },
    {
        "source_id": "HP_PROBOOK440_G10",
        "publisher": "HP",
        "title": "HP ProBook 440 14 inch G10 Notebook PC specifications",
        "url": "https://support.hp.com/in-en/document/ish_7795769-7795857-16",
        "role": "ProBook 440 G10 processor, memory, storage, and display compatibility grounding",
        "price_role": "NONE",
    },
    {
        "source_id": "ACER_OFFICIAL_ID_BUSINESS",
        "publisher": "Acer Official Store Indonesia",
        "title": "For Business laptop catalogue",
        "url": "https://store.acer.com/en-id/acer-for-business",
        "role": "Public Indonesian laptop price-scale sanity anchor; not copied into observations",
        "price_role": "SCALE_ONLY",
    },
    {
        "source_id": "DJP_PPN_11_2022",
        "publisher": "Direktorat Jenderal Pajak",
        "title": "Reformasi PPN Kedepankan Rasa Keadilan",
        "url": "https://pajak.go.id/id/siaran-pers/reformasi-ppn-kedepankan-rasa-keadilan",
        "role": "11 percent VAT context effective 1 April 2022",
        "price_role": "TAX_CONTEXT",
    },
    {
        "source_id": "BPS_CPI_2024",
        "publisher": "Badan Pusat Statistik",
        "title": "Consumer Price Index of 150 Regencies/Municipalities in Indonesia 2024 (2022=100)",
        "url": "https://www.bps.go.id/id/publication/2025/04/10/760f01390477b1248214ac76/consumer-price-index-of-150-regencies-municipalities-in-indonesia-2024--2022-100-.html",
        "role": "Temporal price-context grounding; generator coefficients remain synthetic assumptions",
        "price_role": "TEMPORAL_CONTEXT",
    },
    {
        "source_id": "BI_JISDOR_METHOD",
        "publisher": "Bank Indonesia",
        "title": "JISDOR, reference rates, and BI transaction rates",
        "url": "https://www.bi.go.id/id/fungsi-utama/moneter/informasi-kurs/default.aspx",
        "role": "Imported-component currency-context grounding; no daily exchange-rate values are copied",
        "price_role": "CURRENCY_CONTEXT",
    },
]


@dataclass(frozen=True)
class Family:
    family_id: str
    brand: str
    model_name: str
    source_reference_id: str
    cpu_low: str
    cpu_high: str
    cpu_low_cores: int
    cpu_low_threads: int
    cpu_high_cores: int
    cpu_high_threads: int
    cpu_generation: str
    display_size_inch: float
    display_resolution: str
    display_panel: str
    operating_system: str
    base_price_idr: int
    positioning_multiplier: float


FAMILIES = [
    Family(
        "LENOVO_T14_G4", "Lenovo", "ThinkPad T14 Gen 4", "LENOVO_T14_G4_PSREF",
        "Intel Core i5-1335U", "Intel Core i7-1355U", 10, 12, 10, 12,
        "13th Gen Intel Core", 14.0, "1920x1200", "IPS anti-glare",
        "Windows 11 Pro", 18_800_000, 1.13,
    ),
    Family(
        "DELL_LAT5440", "Dell", "Latitude 5440", "DELL_LATITUDE5440_PROCESSOR",
        "Intel Core i5-1335U", "Intel Core i7-1355U", 10, 12, 10, 12,
        "13th Gen Intel Core", 14.0, "1920x1080", "FHD anti-glare",
        "Windows 11 Pro", 17_900_000, 1.10,
    ),
    Family(
        "HP_PB440_G10", "HP", "ProBook 440 G10", "HP_PROBOOK440_G10",
        "Intel Core i5-1335U", "Intel Core i7-1355U", 10, 12, 10, 12,
        "13th Gen Intel Core", 14.0, "1920x1080", "FHD IPS anti-glare",
        "Windows 11 Pro", 15_900_000, 1.04,
    ),
    Family(
        "LENOVO_TB14_G4", "Lenovo", "ThinkBook 14 Gen 4", "LENOVO_THINKBOOK14_G4",
        "Intel Core i5-1235U", "Intel Core i7-1255U", 10, 12, 10, 12,
        "12th Gen Intel Core", 14.0, "1920x1080", "FHD IPS anti-glare",
        "Windows 11 Pro", 13_900_000, 0.96,
    ),
]


CONFIGURATIONS = [
    (8, 256),
    (8, 512),
    (16, 512),
    (16, 1024),
    (32, 1024),
]


REGIONS = [
    ("ID-JK", "METRO_JAVA", 0, 0),
    ("ID-JB", "CORE_JAVA", 65_000, 1),
    ("ID-JT", "CORE_JAVA", 85_000, 1),
    ("ID-JI", "CORE_JAVA", 95_000, 1),
    ("ID-SU", "WEST_INDONESIA", 180_000, 2),
    ("ID-SS", "WEST_INDONESIA", 210_000, 2),
    ("ID-KI", "CENTRAL_INDONESIA", 270_000, 3),
    ("ID-SN", "CENTRAL_INDONESIA", 310_000, 3),
    ("ID-NT", "EAST_INDONESIA", 430_000, 5),
    ("ID-MA", "EAST_INDONESIA", 560_000, 6),
    ("ID-PA", "REMOTE_EAST", 820_000, 9),
]


SELLER_TIERS = {
    "NATIONAL_DISTRIBUTOR": 0.045,
    "AUTHORIZED_RESELLER": 0.070,
    "VALUE_ADDED_RESELLER": 0.105,
}


SERVICE_BUNDLES = {
    "NONE": 0,
    "STANDARD_SETUP": 180_000,
    "SECURITY_SUITE": 520_000,
    "MANAGED_DEPLOYMENT": 1_050_000,
}


TRAINING_COLUMNS = [
    "schema_version", "record_id", "source_record_id", "source_system",
    "source_reference_id", "is_synthetic", "generator_version", "generation_seed",
    "observed_at", "analysis_cutoff_at", "manufacturer_part_number", "brand",
    "model_name", "cpu", "cpu_family", "cpu_generation", "cpu_cores", "cpu_threads",
    "ram_gb", "ram_type", "storage", "storage_gb", "storage_type", "display",
    "display_size_inch", "display_resolution", "display_panel", "operating_system",
    "condition", "quantity", "unit", "unit_price", "currency", "tax_included",
    "shipping_included", "installation_included", "warranty_months", "delivery_days",
    "region_code", "region_group", "service_bundle", "seller_id", "seller_tier",
    "category_code", "price_basis", "quality_flags",
]


TRUTH_COLUMNS = [
    "record_id", "catalog_sku", "latent_pretax_hardware", "latent_time_multiplier",
    "latent_lifecycle_multiplier", "latent_seller_multiplier", "latent_quantity_multiplier",
    "latent_service_cost", "latent_shipping_cost", "latent_installation_cost",
    "latent_warranty_cost", "latent_tax_multiplier", "latent_noise_multiplier",
    "controlled_price_event", "final_unrounded_price",
]


def month_sequence(start: tuple[int, int], end: tuple[int, int]):
    year, month = start
    while (year, month) <= end:
        yield year, month
        month += 1
        if month == 13:
            year += 1
            month = 1


def iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def round_to_thousand(value: float) -> int:
    return int(round(value / 1000.0) * 1000)


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def catalog_rows() -> list[dict[str, Any]]:
    rows = []
    for family in FAMILIES:
        for cpu_tier, cpu in (("I5", family.cpu_low), ("I7", family.cpu_high)):
            for ram_gb, storage_gb in CONFIGURATIONS:
                sku = f"SYN-{family.family_id}-{cpu_tier}-{ram_gb}-{storage_gb}"
                rows.append({
                    "catalog_sku": sku,
                    "manufacturer_part_number": sku,
                    "family_id": family.family_id,
                    "brand": family.brand,
                    "model_name": family.model_name,
                    "source_reference_id": family.source_reference_id,
                    "cpu": cpu,
                    "cpu_family": "Intel Core i7" if cpu_tier == "I7" else "Intel Core i5",
                    "cpu_generation": family.cpu_generation,
                    "cpu_cores": family.cpu_high_cores if cpu_tier == "I7" else family.cpu_low_cores,
                    "cpu_threads": family.cpu_high_threads if cpu_tier == "I7" else family.cpu_low_threads,
                    "ram_gb": ram_gb,
                    "ram_type": "DDR4-3200",
                    "storage_gb": storage_gb,
                    "storage_type": "NVMe SSD",
                    "display_size_inch": family.display_size_inch,
                    "display_resolution": family.display_resolution,
                    "display_panel": family.display_panel,
                    "operating_system": family.operating_system,
                    "base_price_idr": family.base_price_idr,
                    "positioning_multiplier": family.positioning_multiplier,
                    "synthetic_identifier_notice": "SYN-* identifiers are generated and are not manufacturer part numbers",
                })
    return rows


def latent_hardware_price(catalog: dict[str, Any]) -> float:
    price = float(catalog["base_price_idr"])
    if "i7" in catalog["cpu"].lower():
        price += 2_650_000
    price += {8: 0, 16: 900_000, 32: 2_350_000}[catalog["ram_gb"]]
    price += {256: 0, 512: 650_000, 1024: 1_650_000}[catalog["storage_gb"]]
    return price * float(catalog["positioning_multiplier"])


def weighted_choice(rng: random.Random, values: list[tuple[Any, float]]) -> Any:
    marker = rng.random()
    cumulative = 0.0
    for value, weight in values:
        cumulative += weight
        if marker <= cumulative:
            return value
    return values[-1][0]


def build_rows(seed: int):
    rng = random.Random(seed)
    catalog = catalog_rows()
    training_rows: list[dict[str, Any]] = []
    truth_rows: list[dict[str, Any]] = []
    record_number = 0

    for month_index, (year, month) in enumerate(month_sequence(START_MONTH, END_MONTH)):
        days_in_month = monthrange(year, month)[1]
        for product_index, product in enumerate(catalog):
            hardware_price = latent_hardware_price(product)
            for replicate in range(OBSERVATIONS_PER_SKU_MONTH):
                record_number += 1
                day = 2 + ((product_index * 7 + replicate * 3 + month_index) % max(days_in_month - 2, 1))
                observed = datetime(year, month, day, 3 + replicate, 0, tzinfo=timezone.utc)
                cutoff = observed + timedelta(days=1)

                region_code, region_group, freight_cost, delivery_add = REGIONS[
                    (product_index * 3 + replicate + month_index) % len(REGIONS)
                ]
                seller_tier = list(SELLER_TIERS)[(product_index + replicate + month_index) % len(SELLER_TIERS)]
                seller_id = f"SYN-SELLER-{(product_index * 5 + replicate * 11 + month_index) % 96:03d}"
                quantity = [1, 3, 5, 10, 20, 35, 50, 75, 100, 150][
                    (product_index + replicate * 2 + month_index) % 10
                ]
                service_bundle = weighted_choice(rng, [
                    ("NONE", 0.58),
                    ("STANDARD_SETUP", 0.22),
                    ("SECURITY_SUITE", 0.12),
                    ("MANAGED_DEPLOYMENT", 0.08),
                ])
                warranty_months = weighted_choice(rng, [(12, 0.22), (24, 0.24), (36, 0.54)])
                shipping_actual = rng.random() < 0.89
                installation_actual = service_bundle in {"STANDARD_SETUP", "MANAGED_DEPLOYMENT"} or rng.random() < 0.05
                tax_actual = rng.random() < 0.96

                # Synthetic assumptions, separated in generation_assumptions.json.
                time_multiplier = 1.0 + 0.0019 * month_index
                lifecycle_multiplier = max(0.88, 1.0 - 0.0025 * month_index)
                seasonal_multiplier = 1.012 if month in {10, 11, 12} else 1.0
                seller_multiplier = 1.0 + SELLER_TIERS[seller_tier]
                quantity_multiplier = 1.0 - min(0.085, 0.012 * math.log1p(quantity))
                service_cost = SERVICE_BUNDLES[service_bundle]
                installation_cost = 240_000 if installation_actual else 0
                warranty_cost = {12: 0, 24: 330_000, 36: 760_000}[warranty_months]
                shipping_cost = freight_cost if shipping_actual else 0
                tax_multiplier = 1.11 if tax_actual else 1.0

                sigma = 0.035
                if seller_tier == "VALUE_ADDED_RESELLER":
                    sigma += 0.010
                if region_group in {"EAST_INDONESIA", "REMOTE_EAST"}:
                    sigma += 0.008
                if service_bundle != "NONE":
                    sigma += 0.006
                noise_multiplier = math.exp(rng.gauss(-0.5 * sigma * sigma, sigma))

                controlled_event = "NONE"
                event_draw = rng.random()
                if event_draw < 0.009:
                    controlled_event = "BENIGN_PREMIUM_CONTEXT"
                    noise_multiplier *= rng.uniform(1.16, 1.32)
                elif event_draw < 0.015:
                    controlled_event = "PROMOTIONAL_DISCOUNT"
                    noise_multiplier *= rng.uniform(0.86, 0.93)

                pretax = (
                    hardware_price
                    * time_multiplier
                    * lifecycle_multiplier
                    * seasonal_multiplier
                    * seller_multiplier
                    * quantity_multiplier
                    + service_cost
                    + installation_cost
                    + warranty_cost
                    + shipping_cost
                )
                final_unrounded = pretax * tax_multiplier * noise_multiplier
                unit_price = round_to_thousand(max(final_unrounded, 3_000_000))

                # Reported basis has limited missingness to exercise safe abstention.
                def reported_bool(actual: bool, unknown_rate: float) -> str:
                    if rng.random() < unknown_rate:
                        return "UNKNOWN"
                    return "TRUE" if actual else "FALSE"

                reported_tax = reported_bool(tax_actual, 0.018)
                reported_shipping = reported_bool(shipping_actual, 0.025)
                reported_installation = reported_bool(installation_actual, 0.018)
                reported_warranty: Any = warranty_months if rng.random() >= 0.018 else ""
                reported_part_number = product["manufacturer_part_number"] if rng.random() >= 0.006 else ""
                reported_cpu = product["cpu"] if rng.random() >= 0.004 else ""
                reported_storage = f"{product['storage_gb']}GB {product['storage_type']}" if rng.random() >= 0.004 else ""

                quality_flags = []
                if "UNKNOWN" in {reported_tax, reported_shipping, reported_installation}:
                    quality_flags.append("UNKNOWN_PRICE_BASIS")
                if reported_warranty == "":
                    quality_flags.append("MISSING_WARRANTY")
                if reported_part_number == "" or reported_cpu == "" or reported_storage == "":
                    quality_flags.append("PARTIAL_SPECIFICATION")
                if month_index >= 31:
                    quality_flags.append("STALE_MODEL_LIFECYCLE")

                record_id = f"SYN-PRICE-{record_number:06d}"
                training_rows.append({
                    "schema_version": SCHEMA_VERSION,
                    "record_id": record_id,
                    "source_record_id": record_id,
                    "source_system": "SARING_SYNTHETIC_GROUNDED_V1",
                    "source_reference_id": product["source_reference_id"],
                    "is_synthetic": "TRUE",
                    "generator_version": GENERATOR_VERSION,
                    "generation_seed": seed,
                    "observed_at": iso_utc(observed),
                    "analysis_cutoff_at": iso_utc(cutoff),
                    "manufacturer_part_number": reported_part_number,
                    "brand": product["brand"],
                    "model_name": product["model_name"],
                    "cpu": reported_cpu,
                    "cpu_family": product["cpu_family"],
                    "cpu_generation": product["cpu_generation"],
                    "cpu_cores": product["cpu_cores"],
                    "cpu_threads": product["cpu_threads"],
                    "ram_gb": product["ram_gb"],
                    "ram_type": product["ram_type"],
                    "storage": reported_storage,
                    "storage_gb": product["storage_gb"],
                    "storage_type": product["storage_type"],
                    "display": f"{product['display_size_inch']:.1f} inch {product['display_resolution']} {product['display_panel']}",
                    "display_size_inch": product["display_size_inch"],
                    "display_resolution": product["display_resolution"],
                    "display_panel": product["display_panel"],
                    "operating_system": product["operating_system"],
                    "condition": "NEW",
                    "quantity": quantity,
                    "unit": "UNIT",
                    "unit_price": unit_price,
                    "currency": "IDR",
                    "tax_included": reported_tax,
                    "shipping_included": reported_shipping,
                    "installation_included": reported_installation,
                    "warranty_months": reported_warranty,
                    "delivery_days": 3 + delivery_add + replicate % 3,
                    "region_code": region_code,
                    "region_group": region_group,
                    "service_bundle": service_bundle,
                    "seller_id": seller_id,
                    "seller_tier": seller_tier,
                    "category_code": "LAPTOP_BUSINESS_COTS",
                    "price_basis": "SYNTHETIC_CONDITIONAL_UNIT_PRICE",
                    "quality_flags": "|".join(quality_flags) if quality_flags else "NONE",
                })
                truth_rows.append({
                    "record_id": record_id,
                    "catalog_sku": product["catalog_sku"],
                    "latent_pretax_hardware": round(hardware_price, 4),
                    "latent_time_multiplier": round(time_multiplier, 8),
                    "latent_lifecycle_multiplier": round(lifecycle_multiplier, 8),
                    "latent_seller_multiplier": round(seller_multiplier, 8),
                    "latent_quantity_multiplier": round(quantity_multiplier, 8),
                    "latent_service_cost": service_cost,
                    "latent_shipping_cost": shipping_cost,
                    "latent_installation_cost": installation_cost,
                    "latent_warranty_cost": warranty_cost,
                    "latent_tax_multiplier": tax_multiplier,
                    "latent_noise_multiplier": round(noise_multiplier, 8),
                    "controlled_price_event": controlled_event,
                    "final_unrounded_price": round(final_unrounded, 4),
                })

    return catalog, training_rows, truth_rows


def write_csv_gz(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("wb") as raw_handle:
        with gzip.GzipFile(fileobj=raw_handle, mode="wb", compresslevel=9, mtime=0) as gzip_handle:
            with io.TextIOWrapper(gzip_handle, encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
                writer.writeheader()
                writer.writerows(rows)


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validation_report(training_rows: list[dict[str, Any]], catalog: list[dict[str, Any]]) -> dict[str, Any]:
    prices = [int(row["unit_price"]) for row in training_rows]
    dates = [row["observed_at"] for row in training_rows]
    sku_counts: dict[str, int] = {}
    unknown_basis = 0
    partial_spec = 0
    post_cutoff = 0
    for row in training_rows:
        sku = row["manufacturer_part_number"] or "<MISSING>"
        sku_counts[sku] = sku_counts.get(sku, 0) + 1
        unknown_basis += int("UNKNOWN" in {
            row["tax_included"], row["shipping_included"], row["installation_included"]
        })
        partial_spec += int("PARTIAL_SPECIFICATION" in row["quality_flags"])
        post_cutoff += int(row["observed_at"] > row["analysis_cutoff_at"])

    ordered = sorted(training_rows, key=lambda row: (row["observed_at"], row["record_id"]))
    train_end = int(len(ordered) * 0.64)
    valid_end = int(len(ordered) * 0.80)
    splits = {
        "train": ordered[:train_end],
        "validation": ordered[train_end:valid_end],
        "final_out_of_time_test": ordered[valid_end:],
    }
    split_skus = {
        name: len({row["manufacturer_part_number"] for row in rows if row["manufacturer_part_number"]})
        for name, rows in splits.items()
    }

    return {
        "schema_version": SCHEMA_VERSION,
        "generator_version": GENERATOR_VERSION,
        "row_count": len(training_rows),
        "catalog_configuration_count": len(catalog),
        "source_family_count": len(FAMILIES),
        "date_min": min(dates),
        "date_max": max(dates),
        "price_min_idr": min(prices),
        "price_median_idr": median(prices),
        "price_mean_idr": round(mean(prices), 2),
        "price_max_idr": max(prices),
        "currency_values": sorted({row["currency"] for row in training_rows}),
        "unit_values": sorted({row["unit"] for row in training_rows}),
        "condition_values": sorted({row["condition"] for row in training_rows}),
        "region_count": len({row["region_code"] for row in training_rows}),
        "seller_count": len({row["seller_id"] for row in training_rows}),
        "missing_part_number_rows": sku_counts.get("<MISSING>", 0),
        "unknown_material_basis_rows": unknown_basis,
        "partial_specification_rows": partial_spec,
        "post_cutoff_rows": post_cutoff,
        "duplicate_record_ids": len(training_rows) - len({row["record_id"] for row in training_rows}),
        "split_rows": {name: len(rows) for name, rows in splits.items()},
        "non_missing_skus_by_split": split_skus,
        "minimum_non_missing_sku_observations": min(
            count for sku, count in sku_counts.items() if sku != "<MISSING>"
        ),
        "prohibited_training_columns_present": sorted(
            set(TRAINING_COLUMNS)
            & {"winner", "award", "evaluation_status", "fraud_label", "scenario_label", "contract", "payment"}
        ),
        "checks": {
            "expected_row_count": len(training_rows) == 12_040,
            "unique_record_ids": len(training_rows) == len({row["record_id"] for row in training_rows}),
            "positive_prices": all(price > 0 for price in prices),
            "all_synthetic_marked": all(row["is_synthetic"] == "TRUE" for row in training_rows),
            "no_post_cutoff_evidence": post_cutoff == 0,
            "all_catalog_skus_reach_each_split": all(value == len(catalog) for value in split_skus.values()),
            "no_prohibited_training_columns": True,
        },
    }


def assumptions(seed: int) -> dict[str, Any]:
    return {
        "generator_version": GENERATOR_VERSION,
        "generation_seed": seed,
        "status": "SYNTHETIC_ONLY",
        "public_fact_boundary": (
            "Public sources ground compatible product families, Indonesian price scale, VAT, CPI context, "
            "and exchange-rate context. Every observation and every DGP coefficient is synthetic."
        ),
        "time_window": {"start": "2023-01", "end": "2026-07"},
        "observations_per_sku_month": OBSERVATIONS_PER_SKU_MONTH,
        "vat_assumption": "When included, multiply synthetic pre-tax price by 1.11.",
        "temporal_assumptions": {
            "monthly_general_price_context": 0.0019,
            "monthly_model_lifecycle_depreciation": -0.0025,
            "lifecycle_floor": 0.88,
            "q4_seasonal_multiplier": 1.012,
        },
        "seller_markup_assumptions": SELLER_TIERS,
        "service_bundle_cost_assumptions_idr": SERVICE_BUNDLES,
        "region_shipping_cost_assumptions_idr": {
            code: freight for code, _group, freight, _days in REGIONS
        },
        "warranty_cost_assumptions_idr": {"12": 0, "24": 330_000, "36": 760_000},
        "controlled_event_rates": {
            "benign_premium_context": 0.009,
            "promotional_discount": 0.006,
        },
        "missingness_rates": {
            "tax_basis_unknown": 0.018,
            "shipping_basis_unknown": 0.025,
            "installation_basis_unknown": 0.018,
            "warranty_missing": 0.018,
            "part_number_missing": 0.006,
            "cpu_missing": 0.004,
            "storage_text_missing": 0.004,
        },
        "minimum_comparator_expectation": 8,
        "prohibited_claims": [
            "fraud probability", "state loss", "real market prevalence", "automated procurement decision"
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)

    catalog, training_rows, truth_rows = build_rows(args.seed)
    training_path = output / "price_training_observed_synthetic.csv.gz"
    truth_path = output / "generation_truth_do_not_train.csv.gz"
    catalog_path = output / "product_catalog.csv"

    write_csv_gz(training_path, training_rows, TRAINING_COLUMNS)
    write_csv_gz(truth_path, truth_rows, TRUTH_COLUMNS)
    write_csv(catalog_path, catalog, list(catalog[0]))

    source_registry = {
        "registry_version": "1.0.0",
        "accessed_at": "2026-08-08",
        "notice": "Sources ground facts and context only; no source is represented as the origin of synthetic prices.",
        "sources": SOURCES,
    }
    (output / "source_registry.json").write_text(
        json.dumps(source_registry, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (output / "generation_assumptions.json").write_text(
        json.dumps(assumptions(args.seed), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    report = validation_report(training_rows, catalog)
    report["files"] = {
        training_path.name: {"sha256": file_sha256(training_path), "bytes": training_path.stat().st_size},
        truth_path.name: {"sha256": file_sha256(truth_path), "bytes": truth_path.stat().st_size},
        catalog_path.name: {"sha256": file_sha256(catalog_path), "bytes": catalog_path.stat().st_size},
    }
    (output / "validation_report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    if not all(report["checks"].values()):
        raise SystemExit(f"Validation failed: {report['checks']}")

    print(json.dumps({
        "status": "OK",
        "training_file": str(training_path),
        "rows": len(training_rows),
        "catalog_configurations": len(catalog),
        "sha256": report["files"][training_path.name]["sha256"],
    }, indent=2))


if __name__ == "__main__":
    main()
