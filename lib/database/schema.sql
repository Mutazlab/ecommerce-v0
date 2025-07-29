-- PostgreSQL Schema for Advanced E-commerce Platform
-- Run this script to set up the database structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table with RBAC support
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'customer',
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(32),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer groups for targeted marketing
CREATE TABLE customer_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    is_wholesale BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User group memberships
CREATE TABLE user_group_memberships (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES customer_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, group_id)
);

-- Categories with i18n support
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    parent_id UUID REFERENCES categories(id),
    translations JSONB NOT NULL DEFAULT '{}',
    image_url TEXT,
    seo_title JSONB DEFAULT '{}',
    seo_description JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products with advanced features
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    category_id UUID REFERENCES categories(id),
    translations JSONB NOT NULL DEFAULT '{}',
    price DECIMAL(10,2) NOT NULL,
    compare_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    wholesale_price DECIMAL(10,2),
    pay_what_you_want BOOLEAN DEFAULT false,
    min_price DECIMAL(10,2),
    suggested_prices DECIMAL(10,2)[] DEFAULT '{}',
    weight DECIMAL(8,3),
    dimensions JSONB,
    requires_shipping BOOLEAN DEFAULT true,
    is_digital BOOLEAN DEFAULT false,
    digital_file_url TEXT,
    inventory_tracking BOOLEAN DEFAULT true,
    inventory_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    allow_backorders BOOLEAN DEFAULT false,
    tax_exempt BOOLEAN DEFAULT false,
    tax_class VARCHAR(50),
    seo_title JSONB DEFAULT '{}',
    seo_description JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product variations (size, color, etc.)
CREATE TABLE product_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name JSONB NOT NULL DEFAULT '{}',
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    weight_adjustment DECIMAL(8,3) DEFAULT 0,
    inventory_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product images
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variation_id UUID REFERENCES product_variations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Addresses for shipping and billing
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'shipping' or 'billing'
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(100),
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2) NOT NULL,
    phone VARCHAR(20),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders with comprehensive tracking
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled',
    currency VARCHAR(3) DEFAULT 'USD',
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    shipping_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    shipping_address JSONB,
    billing_address JSONB,
    payment_method VARCHAR(50),
    payment_gateway VARCHAR(50),
    payment_gateway_transaction_id VARCHAR(255),
    notes TEXT,
    internal_notes TEXT,
    tracking_number VARCHAR(100),
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    variation_id UUID REFERENCES product_variations(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    product_snapshot JSONB, -- Store product details at time of order
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shopping carts
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cart items
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variation_id UUID REFERENCES product_variations(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wishlists
CREATE TABLE wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id)
);

-- Coupons and discounts
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed_amount', 'free_shipping'
    value DECIMAL(10,2) NOT NULL,
    minimum_amount DECIMAL(10,2),
    maximum_discount DECIMAL(10,2),
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    customer_usage_limit INTEGER DEFAULT 1,
    applies_to VARCHAR(20) DEFAULT 'all', -- 'all', 'specific_products', 'specific_categories'
    product_ids UUID[] DEFAULT '{}',
    category_ids UUID[] DEFAULT '{}',
    customer_group_ids UUID[] DEFAULT '{}',
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coupon usage tracking
CREATE TABLE coupon_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    order_id UUID REFERENCES orders(id),
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax rates and rules
CREATE TABLE tax_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    rate DECIMAL(8,5) NOT NULL,
    country VARCHAR(2),
    state VARCHAR(100),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    tax_class VARCHAR(50),
    is_compound BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipping zones and methods
CREATE TABLE shipping_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    countries TEXT[] DEFAULT '{}',
    states TEXT[] DEFAULT '{}',
    postal_codes TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shipping_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID REFERENCES shipping_zones(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL, -- 'flat_rate', 'free_shipping', 'local_pickup', 'calculated'
    cost DECIMAL(10,2),
    minimum_order_amount DECIMAL(10,2),
    maximum_order_amount DECIMAL(10,2),
    handling_fee DECIMAL(10,2) DEFAULT 0,
    tax_status VARCHAR(20) DEFAULT 'taxable',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email templates for automation
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    subject JSONB NOT NULL DEFAULT '{}',
    body JSONB NOT NULL DEFAULT '{}',
    type VARCHAR(50) NOT NULL, -- 'order_confirmation', 'abandoned_cart', 'welcome', etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User behavior tracking for recommendations
CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    activity_type VARCHAR(50) NOT NULL, -- 'view', 'add_to_cart', 'purchase', 'search'
    product_id UUID REFERENCES products(id),
    category_id UUID REFERENCES categories(id),
    search_query TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook configurations
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook delivery logs
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys for developer access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_products_translations_gin ON products USING gin(translations);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_user_activities_user ON user_activities(user_id);
CREATE INDEX idx_user_activities_product ON user_activities(product_id);
CREATE INDEX idx_user_activities_created ON user_activities(created_at);

-- Full-text search indexes
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('english', 
    COALESCE(translations->>'en_name', '') || ' ' || 
    COALESCE(translations->>'en_description', '') || ' ' || 
    array_to_string(tags, ' ')
));

CREATE INDEX idx_products_search_ar ON products USING gin(to_tsvector('arabic', 
    COALESCE(translations->>'ar_name', '') || ' ' || 
    COALESCE(translations->>'ar_description', '')
));
