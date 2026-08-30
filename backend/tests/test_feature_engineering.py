"""
backend/tests/test_feature_engineering.py

Tests for the reusable feature engineering functions and FeatureEngineer transformer.
Covers:
  - Cost Overrun % calculation & zero/negative cost handling
  - Cost Growth calculation
  - Expenditure Ratio calculation
  - Time Overrun calculation
  - Project Age calculation
  - Physical Progress scaling & clipping
  - Discrepancy metrics
  - FeatureEngineer sklearn transformer integration
"""

import math
import unittest
import numpy as np
import pandas as pd

from pipeline.feature_engineering import (
    FeatureEngineer,
    OUTPUT_FEATURE_NAMES,
    calc_all_features,
    calc_cost_growth,
    calc_cost_overrun_percentage,
    calc_expenditure_ratio,
    calc_physical_progress_ratio,
    calc_planned_duration_months,
    calc_progress_spend_discrepancy,
    calc_progress_time_discrepancy,
    calc_project_age_months,
    calc_time_overrun_months,
)


class TestFeatureEngineering(unittest.TestCase):

    def test_cost_overrun_percentage_standard(self):
        # 100 to 150 = 50% overrun
        pct = calc_cost_overrun_percentage(revised_cost=150.0, original_cost=100.0)
        self.assertAlmostEqual(pct, 50.0, places=2)

        # 200 to 180 = -10% (under budget)
        pct_under = calc_cost_overrun_percentage(revised_cost=180.0, original_cost=200.0)
        self.assertAlmostEqual(pct_under, -10.0, places=2)

    def test_cost_overrun_percentage_edge_cases(self):
        # Zero original cost -> returns None (safe div)
        self.assertIsNone(calc_cost_overrun_percentage(revised_cost=100.0, original_cost=0.0))
        # Negative original cost -> returns None
        self.assertIsNone(calc_cost_overrun_percentage(revised_cost=100.0, original_cost=-50.0))
        # None inputs -> returns None
        self.assertIsNone(calc_cost_overrun_percentage(revised_cost=None, original_cost=100.0))
        self.assertIsNone(calc_cost_overrun_percentage(revised_cost=100.0, original_cost=None))
        # NaN inputs
        self.assertIsNone(calc_cost_overrun_percentage(revised_cost=float("nan"), original_cost=100.0))

    def test_cost_growth(self):
        growth = calc_cost_growth(revised_cost=611.8, original_cost=500.0)
        self.assertAlmostEqual(growth, 111.8, places=2)
        self.assertIsNone(calc_cost_growth(revised_cost=None, original_cost=500.0))

    def test_expenditure_ratio(self):
        ratio = calc_expenditure_ratio(cumulative_expenditure=75.0, cost_basis=100.0)
        self.assertAlmostEqual(ratio, 0.75, places=2)
        # Zero cost basis -> None
        self.assertIsNone(calc_expenditure_ratio(cumulative_expenditure=75.0, cost_basis=0.0))

    def test_time_overrun_months(self):
        # Jan 2022 to July 2022 = ~6 months
        overrun = calc_time_overrun_months(
            revised_completion="2022-07-01",
            original_target_completion="2022-01-01",
        )
        self.assertIsNotNone(overrun)
        self.assertTrue(5.5 <= overrun <= 6.5)

        # Invalid date string -> None
        self.assertIsNone(calc_time_overrun_months("invalid-date", "2022-01-01"))

    def test_project_age_months(self):
        age = calc_project_age_months(
            date_of_approval="2020-01-01",
            snapshot_date="2022-01-01",
        )
        self.assertIsNotNone(age)
        self.assertTrue(23.5 <= age <= 24.5)

    def test_physical_progress_ratio(self):
        # 0-100 scale
        self.assertAlmostEqual(calc_physical_progress_ratio(75.0), 0.75, places=2)
        # 0-1 scale
        self.assertAlmostEqual(calc_physical_progress_ratio(0.45), 0.45, places=2)
        # Negative -> 0.0
        self.assertAlmostEqual(calc_physical_progress_ratio(-5.0), 0.0, places=2)
        # None -> None
        self.assertIsNone(calc_physical_progress_ratio(None))

    def test_progress_spend_discrepancy(self):
        # Spending ratio 0.80 with progress 0.30 -> discrepancy +0.50 (red flag)
        disc = calc_progress_spend_discrepancy(expenditure_ratio=0.80, physical_progress_ratio=0.30)
        self.assertAlmostEqual(disc, 0.50, places=2)

    def test_calc_all_features(self):
        sample = {
            "original_cost": 500.0,
            "revised_cost": 650.0,
            "cumulative_expenditure": 400.0,
            "physical_progress": 60.0,
            "date_of_approval": "2020-01-01",
            "original_target_completion": "2023-01-01",
            "revised_completion": "2024-01-01",
            "edition": "2022-06-01",
        }
        res = calc_all_features(sample)
        self.assertAlmostEqual(res["cost_overrun_pct"], 30.0, places=2)
        self.assertAlmostEqual(res["cost_growth"], 150.0, places=2)
        self.assertAlmostEqual(res["expenditure_ratio"], 0.80, places=2)
        self.assertAlmostEqual(res["physical_progress_ratio"], 0.60, places=2)
        self.assertTrue(res["time_overrun_months"] > 11.0)
        self.assertTrue(res["planned_duration_months"] > 35.0)

    def test_feature_engineer_transformer(self):
        fe = FeatureEngineer()
        sample_df = pd.DataFrame([{
            "project_name": "Four Laning of Highway NH-44",
            "agency": "National Highways Authority of India [NHAI]",
            "state": "Maharashtra",
            "doa": "2020-01-01",
            "original_target_doa": "2023-01-01",
            "original_cost": 1200.0,
            "cumulative_expenditure": 600.0,
            "physical_progress": 55.0,
            "edition": "2022-07-01",
        }])

        X_out = fe.transform(sample_df)
        self.assertEqual(X_out.shape, (1, 23))
        self.assertEqual(len(fe.get_feature_names_out()), 23)
        self.assertEqual(list(fe.get_feature_names_out()), OUTPUT_FEATURE_NAMES)


if __name__ == "__main__":
    unittest.main()
