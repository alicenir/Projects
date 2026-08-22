import { z } from "zod";

/**
 * Shapes mirror TeslaMateApi's actual Go response structs (verified against
 * github.com/tobiasehlert/teslamateapi source, not just its README) rather
 * than a guess. Two quirks worth calling out:
 *  - Handler-level failures respond HTTP 200 with `{ "error": "..." }` —
 *    only auth failures return a real 401/403. See api/client.ts.
 *  - List endpoints (drives/charges/updates/cars) build their array with a
 *    `var x []T` that's never appended to when there are zero rows, and Go
 *    marshals a nil slice as `null`, not `[]` — so every list here is
 *    `.nullable()` and normalized to `[]` below.
 */

const emptyArray = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .array(schema)
    .nullable()
    .transform((v): z.infer<T>[] => v ?? []);

export const pingSchema = z.object({ message: z.string() });

export const apiErrorSchema = z.object({ error: z.string() });

const carLocationSchema = z.object({ latitude: z.number(), longitude: z.number() });

// ---------------------------------------------------------------- /cars ----
export const carSchema = z.object({
  car_id: z.number(),
  name: z.string().nullable(),
  car_details: z.object({
    eid: z.number(),
    vid: z.number(),
    vin: z.string(),
    model: z.string().nullable(),
    trim_badging: z.string().nullable(),
    efficiency: z.number().nullable(),
  }),
  car_exterior: z.object({
    exterior_color: z.string().nullable(),
    spoiler_type: z.string().nullable(),
    wheel_type: z.string().nullable(),
  }),
  car_settings: z.object({
    suspend_min: z.number(),
    suspend_after_idle_min: z.number(),
    req_not_unlocked: z.boolean(),
    free_supercharging: z.boolean(),
    use_streaming_api: z.boolean(),
  }),
  teslamate_details: z.object({ inserted_at: z.string(), updated_at: z.string() }),
  teslamate_stats: z.object({
    total_charges: z.number(),
    total_drives: z.number(),
    total_updates: z.number(),
  }),
});
export type Car = z.infer<typeof carSchema>;

export const carsResponseSchema = z.object({
  data: z.object({ cars: emptyArray(carSchema) }),
});

// --------------------------------------------------------------- /status ---
export const statusResponseSchema = z.object({
  data: z.object({
    car: z.object({ car_id: z.number(), car_name: z.string().nullable() }),
    status: z.object({
      display_name: z.string(),
      state: z.string(),
      state_since: z.string(),
      odometer: z.number(),
      car_status: z.object({
        healthy: z.boolean(),
        locked: z.boolean(),
        sentry_mode: z.boolean(),
        windows_open: z.boolean(),
        doors_open: z.boolean(),
        driver_front_door_open: z.boolean(),
        driver_rear_door_open: z.boolean(),
        passenger_front_door_open: z.boolean(),
        passenger_rear_door_open: z.boolean(),
        trunk_open: z.boolean(),
        frunk_open: z.boolean(),
        is_user_present: z.boolean(),
        center_display_state: z.number(),
      }),
      car_details: z.object({ model: z.string(), trim_badging: z.string() }),
      car_exterior: z.object({
        exterior_color: z.string(),
        spoiler_type: z.string(),
        wheel_type: z.string(),
      }),
      car_geodata: z.object({
        geofence: z.string(),
        location: carLocationSchema,
        latitude: z.number(),
        longitude: z.number(),
      }),
      car_versions: z.object({
        version: z.string(),
        update_available: z.boolean(),
        update_version: z.string(),
      }),
      driving_details: z.object({
        active_route: z.object({
          destination: z.string(),
          energy_at_arrival: z.number(),
          distance_to_arrival: z.number(),
          minutes_to_arrival: z.number(),
          traffic_minutes_delay: z.number(),
          location: carLocationSchema,
        }),
        shift_state: z.string(),
        power: z.number(),
        speed: z.number(),
        heading: z.number(),
        elevation: z.number(),
      }),
      climate_details: z.object({
        is_climate_on: z.boolean(),
        inside_temp: z.number(),
        outside_temp: z.number(),
        is_preconditioning: z.boolean(),
        climate_keeper_mode: z.string(),
      }),
      battery_details: z.object({
        est_battery_range: z.number(),
        rated_battery_range: z.number(),
        ideal_battery_range: z.number(),
        battery_level: z.number(),
        usable_battery_level: z.number(),
      }),
      charging_details: z.object({
        plugged_in: z.boolean(),
        charging_state: z.string(),
        charge_energy_added: z.number(),
        charge_limit_soc: z.number(),
        charge_port_door_open: z.boolean(),
        charger_actual_current: z.number(),
        charger_phases: z.number(),
        charger_power: z.number(),
        charger_voltage: z.number(),
        charge_current_request: z.number(),
        charge_current_request_max: z.number(),
        scheduled_charging_start_time: z.string(),
        time_to_full_charge: z.number(),
      }),
      tpms_details: z.object({
        tpms_pressure_fl: z.number(),
        tpms_pressure_fr: z.number(),
        tpms_pressure_rl: z.number(),
        tpms_pressure_rr: z.number(),
        tpms_soft_warning_fl: z.boolean(),
        tpms_soft_warning_fr: z.boolean(),
        tpms_soft_warning_rl: z.boolean(),
        tpms_soft_warning_rr: z.boolean(),
      }),
    }),
    units: z.object({
      unit_of_length: z.string(),
      unit_of_pressure: z.string(),
      unit_of_temperature: z.string(),
    }),
  }),
});
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type CarStatus = StatusResponse["data"]["status"];

// --------------------------------------------------------------- drives ----
const driveBatteryDetailsSchema = z.object({
  start_usable_battery_level: z.number(),
  start_battery_level: z.number(),
  end_usable_battery_level: z.number(),
  end_battery_level: z.number(),
  reduced_range: z.boolean(),
  is_sufficiently_precise: z.boolean(),
});
const preferredRangeSchema = z.object({
  start_range: z.number(),
  end_range: z.number(),
  range_diff: z.number().optional(),
});

export const driveSchema = z.object({
  drive_id: z.number(),
  start_date: z.string(),
  end_date: z.string(),
  start_address: z.string(),
  end_address: z.string(),
  odometer_details: z.object({
    odometer_start: z.number(),
    odometer_end: z.number(),
    odometer_distance: z.number(),
  }),
  duration_min: z.number(),
  duration_str: z.string(),
  speed_max: z.number(),
  speed_avg: z.number(),
  power_max: z.number(),
  power_min: z.number(),
  battery_details: driveBatteryDetailsSchema,
  range_ideal: preferredRangeSchema,
  range_rated: preferredRangeSchema,
  outside_temp_avg: z.number().nullable(),
  inside_temp_avg: z.number().nullable(),
  energy_consumed_net: z.number().nullable(),
  consumption_net: z.number().nullable(),
});
export type Drive = z.infer<typeof driveSchema>;

export const drivesResponseSchema = z.object({
  data: z.object({
    car: z.object({ car_id: z.number(), car_name: z.string().nullable() }),
    drives: emptyArray(driveSchema),
    units: z.object({ unit_of_length: z.string(), unit_of_temperature: z.string() }),
  }),
});
export type DrivesResponse = z.infer<typeof drivesResponseSchema>;

const driveDetailPointSchema = z.object({
  detail_id: z.number(),
  date: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  speed: z.number(),
  power: z.number(),
  odometer: z.number(),
  battery_level: z.number(),
  usable_battery_level: z.number().nullable(),
  elevation: z.number().nullable(),
  climate_info: z.object({
    inside_temp: z.number().nullable(),
    outside_temp: z.number().nullable(),
    is_climate_on: z.boolean().nullable(),
    fan_status: z.number().nullable(),
    driver_temp_setting: z.number().nullable(),
    passenger_temp_setting: z.number().nullable(),
    is_rear_defroster_on: z.boolean().nullable(),
    is_front_defroster_on: z.boolean().nullable(),
  }),
  battery_info: z.object({
    est_battery_range: z.number().nullable(),
    ideal_battery_range: z.number().nullable(),
    rated_battery_range: z.number().nullable(),
    battery_heater: z.boolean().nullable(),
    battery_heater_on: z.boolean().nullable(),
    battery_heater_no_power: z.boolean().nullable(),
  }),
});
export type DriveDetailPoint = z.infer<typeof driveDetailPointSchema>;

export const driveDetailResponseSchema = z.object({
  data: z.object({
    car: z.object({ car_id: z.number(), car_name: z.string().nullable() }),
    drive: driveSchema.extend({ drive_details: emptyArray(driveDetailPointSchema) }),
    units: z.object({ unit_of_length: z.string(), unit_of_temperature: z.string() }),
  }),
});
export type DriveDetail = z.infer<typeof driveDetailResponseSchema>["data"]["drive"];

// -------------------------------------------------------------- charges ----
export const chargeSchema = z.object({
  charge_id: z.number(),
  start_date: z.string(),
  end_date: z.string(),
  address: z.string(),
  charge_energy_added: z.number(),
  charge_energy_used: z.number(),
  cost: z.number(),
  duration_min: z.number(),
  duration_str: z.string(),
  battery_details: z.object({ start_battery_level: z.number(), end_battery_level: z.number() }),
  range_ideal: z.object({ start_range: z.number(), end_range: z.number() }),
  range_rated: z.object({ start_range: z.number(), end_range: z.number() }),
  outside_temp_avg: z.number(),
  odometer: z.number(),
  latitude: z.number(),
  longitude: z.number(),
});
export type Charge = z.infer<typeof chargeSchema>;

export const chargesResponseSchema = z.object({
  data: z.object({
    car: z.object({ car_id: z.number(), car_name: z.string().nullable() }),
    charges: emptyArray(chargeSchema),
    units: z.object({ unit_of_length: z.string(), unit_of_temperature: z.string() }),
  }),
});
export type ChargesResponse = z.infer<typeof chargesResponseSchema>;

const chargeDetailSampleSchema = z.object({
  detail_id: z.number(),
  date: z.string(),
  battery_level: z.number(),
  usable_battery_level: z.number(),
  charge_energy_added: z.number(),
  not_enough_power_to_heat: z.boolean().nullable(),
  charger_details: z.object({
    charger_actual_current: z.number(),
    charger_phases: z.number(),
    charger_pilot_current: z.number(),
    charger_power: z.number(),
    charger_voltage: z.number(),
  }),
  battery_info: z.object({
    ideal_battery_range: z.number(),
    rated_battery_range: z.number(),
    battery_heater: z.boolean(),
    battery_heater_on: z.boolean(),
    battery_heater_no_power: z.boolean().nullable(),
  }),
  conn_charge_cable: z.string(),
  fast_charger_info: z.object({
    fast_charger_present: z.boolean(),
    fast_charger_brand: z.string().nullable(),
    fast_charger_type: z.string(),
  }),
  outside_temp: z.number(),
});
export type ChargeDetailSample = z.infer<typeof chargeDetailSampleSchema>;

export const chargeDetailResponseSchema = z.object({
  data: z.object({
    car: z.object({ car_id: z.number(), car_name: z.string().nullable() }),
    charge: chargeSchema.extend({ charge_details: emptyArray(chargeDetailSampleSchema) }),
    units: z.object({ unit_of_length: z.string(), unit_of_temperature: z.string() }),
  }),
});
export type ChargeDetail = z.infer<typeof chargeDetailResponseSchema>["data"]["charge"];

// --------------------------------------------------------- battery-health --
export const batteryHealthResponseSchema = z.object({
  data: z.object({
    car: z.object({ car_id: z.number(), car_name: z.string().nullable() }),
    battery_health: z.object({
      max_range: z.number(),
      current_range: z.number(),
      max_capacity: z.number(),
      current_capacity: z.number(),
      rated_efficiency: z.number(),
      battery_health_percentage: z.number(),
    }),
    units: z.object({ unit_of_length: z.string(), unit_of_temperature: z.string() }),
  }),
});
export type BatteryHealth = z.infer<typeof batteryHealthResponseSchema>["data"]["battery_health"];

// -------------------------------------------------------------- updates ----
export const updateSchema = z.object({
  update_id: z.number(),
  start_date: z.string(),
  end_date: z.string(),
  version: z.string(),
});
export type CarUpdate = z.infer<typeof updateSchema>;

export const updatesResponseSchema = z.object({
  data: z.object({
    car: z.object({ car_id: z.number(), car_name: z.string().nullable() }),
    updates: emptyArray(updateSchema),
  }),
});

// --------------------------------------------------------- globalsettings --
export const globalSettingsResponseSchema = z.object({
  data: z.object({
    settings: z.object({
      setting_id: z.number(),
      account_info: z.object({ inserted_at: z.string(), updated_at: z.string() }),
      teslamate_units: z.object({ unit_of_length: z.string(), unit_of_temperature: z.string() }),
      teslamate_webgui: z.object({ preferred_range: z.string(), language: z.string() }),
      teslamate_urls: z.object({ base_url: z.string(), grafana_url: z.string() }),
    }),
  }),
});
export type GlobalSettings = z.infer<typeof globalSettingsResponseSchema>["data"]["settings"];
