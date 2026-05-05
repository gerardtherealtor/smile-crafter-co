import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = ({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: "admin" | "employee";
}) => {
  const { user, role, loading, roleLoading } = useAuth();

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-muted-foreground font-display text-lg tracking-widest">LOADING…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (requireRole === "admin" && role !== "admin") {
    return <Navigate to="/employee" replace />;
  }
  if (requireRole === "employee" && role !== "employee" && role !== "admin") {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
