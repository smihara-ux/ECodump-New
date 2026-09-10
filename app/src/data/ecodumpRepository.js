import { databaseMode, supabase } from "../lib/supabase";

const throwDatabaseError = (operation, error) => {
  const wrapped = new Error(`${operation}に失敗しました。`);
  wrapped.code = error?.code || "DATABASE_ERROR";
  wrapped.cause = error;
  throw wrapped;
};

const requireCloud = () => {
  if (!supabase) throw new Error("クラウドDBが設定されていません。");
  return supabase;
};

export const ecodumpRepository = {
  mode: databaseMode,

  async getSession() {
    if (!supabase) return { session: null, mode: "demo" };
    const { data, error } = await supabase.auth.getSession();
    if (error) throwDatabaseError("セッション確認", error);
    return { session: data.session, mode: "cloud" };
  },

  async listSites(fallback = []) {
    if (!supabase) return { data: fallback, source: "demo" };
    const { data, error } = await supabase
      .from("sites")
      .select(
        "id, external_code, name, address, start_on, end_on, status, organization_id, project_id, organization:organizations(name), project:projects(name)",
      )
      .order("name");
    if (error) throwDatabaseError("現場一覧の取得", error);
    return { data, source: "cloud" };
  },

  async listTodayTransportOrders(siteId, fallback = []) {
    if (!supabase) return { data: fallback, source: "demo" };
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("transport_orders")
      .select(
        "id, order_code, status, planned_departure_at, estimated_arrival_at, cargo_type, planned_volume_m3, actual_volume_m3, vehicle_id, driver_id, departure_site_id, destination_site_id",
      )
      .eq("departure_site_id", siteId)
      .gte("planned_departure_at", `${today}T00:00:00`)
      .lt("planned_departure_at", `${today}T23:59:59.999`)
      .order("planned_departure_at");
    if (error) throwDatabaseError("運行予定の取得", error);
    return { data, source: "cloud" };
  },

  async listVehicles(organizationId, fallback = []) {
    if (!supabase) return { data: fallback, source: "demo" };
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, registration_number, display_name, vehicle_class, width_m, height_m, length_m, gross_weight_t, axle_weight_t, active")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("registration_number");
    if (error) throwDatabaseError("車両一覧の取得", error);
    return { data, source: "cloud" };
  },

  async listDrivers(organizationId, fallback = []) {
    if (!supabase) return { data: fallback, source: "demo" };
    const { data, error } = await supabase
      .from("drivers")
      .select("id, display_name, profile_id, license_expires_on, active")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("display_name");
    if (error) throwDatabaseError("運転手一覧の取得", error);
    return { data, source: "cloud" };
  },

  async createTransportOrder(order) {
    const client = requireCloud();
    const { data, error } = await client
      .from("transport_orders")
      .insert(order)
      .select()
      .single();
    if (error) throwDatabaseError("運行予定の登録", error);
    return data;
  },

  async updateTransportOrder(id, changes) {
    const client = requireCloud();
    const { data, error } = await client
      .from("transport_orders")
      .update(changes)
      .eq("id", id)
      .select()
      .single();
    if (error) throwDatabaseError("運行予定の更新", error);
    return data;
  },

  async saveRoutePlan(routePlan) {
    const client = requireCloud();
    const { data, error } = await client
      .from("route_plans")
      .upsert(routePlan)
      .select()
      .single();
    if (error) throwDatabaseError("運行経路の保存", error);
    return data;
  },

  subscribeToVehiclePositions(organizationId, onPosition, onStatus = () => {}) {
    if (!supabase) {
      onStatus("demo");
      return () => {};
    }
    const channel = supabase
      .channel(`vehicle-positions:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vehicle_positions",
          filter: `organization_id=eq.${organizationId}`,
        },
        ({ new: position }) => onPosition(position),
      )
      .subscribe((status) => onStatus(status));
    return () => supabase.removeChannel(channel);
  },
};
