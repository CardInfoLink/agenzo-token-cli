/**
 * Ride API request/response types and the services registry.
 *
 * Monetary amounts are decimals in the currency's standard unit
 * (e.g. 12.50 USD), NOT minor units / cents.
 */

// ---- Geo ----

export interface GeoPoint {
  lat: number;
  lng: number;
  name: string;
}

export type Pickup = GeoPoint;
export type Dropoff = GeoPoint;

// ---- Quote ----

export interface QuoteRequest {
  pickup: Pickup;
  dropoff: Dropoff;
  service_id?: string;
  pickup_time?: string;
  passengers?: number;
}

export interface Price {
  amount: number;
  currency: string;
  quote_id: string;
}

export interface VehicleClass {
  vehicle_class: string;
  price: Price;
  passenger_capacity: number;
  luggage_capacity: number;
}

export interface QuoteResponse {
  vehicle_classes: VehicleClass[];
}

// ---- Booking ----

export interface Passenger {
  name: string;
  phone?: string;
  email?: string;
}

export interface BookRequest {
  quote_id: string;
  vehicle_class: string;
  passenger: Passenger;
  pickup_time?: string;
  notes?: string;
}

/** Case-sensitive order status (matches server casing exactly). */
export type OrderStatus =
  | 'Pending'
  | 'Accepted'
  | 'On my way'
  | 'Waiting'
  | 'On board'
  | 'At destination'
  | 'Rejected'
  | 'Cancelled'
  | 'Customer no show'
  | 'Driver no show';

export interface Order {
  order_id: string;
  status: OrderStatus;
  vehicle_class: string;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  amount: number;
  currency: string;
  created_at: string;
}

export type BookResponse = Order;
export type GetOrderResponse = Order;

// ---- Cancellation ----

export interface Cancellation {
  cancellation_fee: number;
  reversal_amount: number;
  currency: string;
}

export interface CancelResponse {
  cancellation: Cancellation;
}

// ---- Listing ----

export interface ListOrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  page_size: number;
}

// ---- Services registry ----

export interface Service {
  service_id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

export interface ListServicesResponse {
  services: Service[];
}

export type GetServiceResponse = Service;
