-- Create role enum
CREATE TYPE public.app_role AS ENUM ('user', 'camp', 'ngo');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create camps table
CREATE TABLE public.camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  total_capacity INTEGER NOT NULL DEFAULT 0,
  occupied_seats INTEGER NOT NULL DEFAULT 0,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'full')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;

-- Camps policies
CREATE POLICY "Anyone can view active camps"
  ON public.camps FOR SELECT
  USING (status = 'active');

CREATE POLICY "Camp admins can insert camps"
  ON public.camps FOR INSERT
  WITH CHECK (
    auth.uid() = camp_admin_id AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'camp')
  );

CREATE POLICY "Camp admins can update own camps"
  ON public.camps FOR UPDATE
  USING (auth.uid() = camp_admin_id);

-- Create camp_needs table
CREATE TABLE public.camp_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity_needed INTEGER NOT NULL,
  quantity_fulfilled INTEGER DEFAULT 0,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'fulfilled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.camp_needs ENABLE ROW LEVEL SECURITY;

-- Camp needs policies
CREATE POLICY "Anyone can view camp needs"
  ON public.camp_needs FOR SELECT
  USING (true);

CREATE POLICY "Camp admins can manage needs"
  ON public.camp_needs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.camps
      WHERE camps.id = camp_id AND camps.camp_admin_id = auth.uid()
    )
  );

-- Create volunteers table
CREATE TABLE public.volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  camp_id UUID REFERENCES public.camps(id) ON DELETE CASCADE,
  volunteer_type TEXT NOT NULL CHECK (volunteer_type IN ('camp_volunteer', 'transportation', 'general')),
  skills TEXT,
  availability TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, camp_id, volunteer_type)
);

ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;

-- Volunteers policies
CREATE POLICY "Users can view all volunteers"
  ON public.volunteers FOR SELECT
  USING (true);

CREATE POLICY "Users can register as volunteers"
  ON public.volunteers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own volunteer status"
  ON public.volunteers FOR UPDATE
  USING (auth.uid() = user_id);

-- Create ngo_assistance table
CREATE TABLE public.ngo_assistance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  need_id UUID REFERENCES public.camp_needs(id) ON DELETE SET NULL,
  items_provided TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  delivery_status TEXT DEFAULT 'pledged' CHECK (delivery_status IN ('pledged', 'in_transit', 'delivered')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ngo_assistance ENABLE ROW LEVEL SECURITY;

-- NGO assistance policies
CREATE POLICY "Anyone can view assistance"
  ON public.ngo_assistance FOR SELECT
  USING (true);

CREATE POLICY "NGOs can provide assistance"
  ON public.ngo_assistance FOR INSERT
  WITH CHECK (
    auth.uid() = ngo_id AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ngo')
  );

CREATE POLICY "NGOs can update own assistance"
  ON public.ngo_assistance FOR UPDATE
  USING (auth.uid() = ngo_id);

-- Trigger for updating camp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_camps_updated_at
  BEFORE UPDATE ON public.camps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'user'),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();