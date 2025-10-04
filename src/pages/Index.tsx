import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import UserDashboard from "@/components/dashboards/UserDashboard";
import CampDashboard from "@/components/dashboards/CampDashboard";
import NGODashboard from "@/components/dashboards/NGODashboard";
import { Button } from "@/components/ui/button";
import { Shield, Home, Building2, AlertCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session?.user) {
          fetchUserRole(session.user.id);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setUserRole(data?.role || null);
    } catch (error) {
      console.error("Error fetching user role:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <AlertCircle className="w-12 h-12 text-accent" />
              <h1 className="text-5xl font-bold">Kerala Relief Hub</h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Coordinating disaster relief efforts across Kerala. Connect camps, volunteers, and NGOs in times of crisis.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            <div className="bg-card p-6 rounded-lg border shadow-sm">
              <Shield className="w-10 h-10 text-primary mb-3" />
              <h3 className="text-xl font-semibold mb-2">For Citizens</h3>
              <p className="text-muted-foreground">
                Find nearby relief camps, register as a volunteer, and help your community during disasters.
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg border shadow-sm">
              <Home className="w-10 h-10 text-accent mb-3" />
              <h3 className="text-xl font-semibold mb-2">For Camps</h3>
              <p className="text-muted-foreground">
                Manage camp capacity, list urgent needs, and coordinate with volunteers and NGOs.
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg border shadow-sm">
              <Building2 className="w-10 h-10 text-success mb-3" />
              <h3 className="text-xl font-semibold mb-2">For NGOs</h3>
              <p className="text-muted-foreground">
                View camp requirements, provide supplies, and coordinate relief operations efficiently.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render appropriate dashboard based on user role
  return (
    <div className="min-h-screen bg-background">
      {userRole === "user" && <UserDashboard onSignOut={handleSignOut} />}
      {userRole === "camp" && <CampDashboard onSignOut={handleSignOut} />}
      {userRole === "ngo" && <NGODashboard onSignOut={handleSignOut} />}
    </div>
  );
};

export default Index;