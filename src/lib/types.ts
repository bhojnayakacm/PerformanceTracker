import type { Tables, TablesInsert, TablesUpdate } from "@/types/database.types";

export type Employee = Tables<"employees">;
export type EmployeeInsert = TablesInsert<"employees">;
export type EmployeeUpdate = TablesUpdate<"employees">;

export type MonthlyTarget = Tables<"monthly_targets">;
export type MonthlyActual = Tables<"monthly_actuals">;
export type DailyMetric = Tables<"daily_metrics">;
export type City = Tables<"cities">;
export type MonthlyCityTour = Tables<"monthly_city_tours">;

/**
 * A per-city tour row with its city metadata joined in.
 * Used when loading the employee detail sheet so we can render the city name.
 */
export type CityTourWithCity = MonthlyCityTour & {
  city: Pick<City, "id" | "name">;
};

export type EmployeeMonthlyData = {
  employee: Employee;
  target: MonthlyTarget | null;
  actual: MonthlyActual | null;
  cityTours: CityTourWithCity[];
};

export type Profile = Tables<"profiles">;

export type UserRole = "super_admin" | "manager" | "editor" | "viewer";
