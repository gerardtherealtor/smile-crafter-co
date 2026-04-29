import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, HardHat, Shield } from "lucide-react";

export const PortalLayout = ({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) => {
  const { signOut, role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="container flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-gradient-maple grid place-items-center shadow-maple font-display text-lg text-maple-foreground">
              D
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="font-display text-sm tracking-wide">DWAYNE NOE</div>
              <div className="text-[9px] tracking-[0.3em] text-maple uppercase">Construction</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
              {role === "admin" ? (
                <><Shield className="h-3 w-3 text-maple" /> Admin</>
              ) : (
                <><HardHat className="h-3 w-3 text-maple" /> Crew</>
              )}
            </span>
            {role === "admin" && (
              <Button asChild variant="ghost" size="sm" className="font-display tracking-wider hidden sm:inline-flex">
                <Link to="/admin">Admin</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="font-display tracking-wider">
              <Link to="/employee">My Time</Link>
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm" className="border-border">
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-3xl sm:text-4xl uppercase tracking-wide">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm sm:text-base mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
};
