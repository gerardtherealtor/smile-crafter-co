import { ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, HardHat, Shield, Settings as SettingsIcon } from "lucide-react";
import logo from "@/assets/logo.png";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SupportTicketButton } from "@/components/SupportTicketButton";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const PortalLayout = ({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) => {
  const { signOut, role, user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const email = user?.email ?? "";
  const initial = email ? email.charAt(0).toUpperCase() : "?";

  return (
    <div className="min-h-screen bg-background">
      <header
        className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
      >
        <div className="container flex items-center justify-between py-3 gap-2">
          <Link to="/" className="flex items-center group shrink-0">
            <img
              src={logo}
              alt="Dwayne Noe Construction"
              width={1024}
              height={1024}
              className="h-20 w-auto transition-transform group-hover:scale-105 [filter:brightness(0)_invert(1)]"
            />
          </Link>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
              {role === "admin" ? (
                <><Shield className="h-3 w-3 text-maple" /> {t("portal.admin")}</>
              ) : (
                <><HardHat className="h-3 w-3 text-maple" /> {t("portal.crew")}</>
              )}
            </span>
            <LanguageToggle variant="compact" />
            {role === "admin" && (
              <Button asChild variant="ghost" size="sm" className="font-display tracking-wider hidden sm:inline-flex">
                <Link to="/admin">{t("portal.admin")}</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="font-display tracking-wider">
              <Link to="/employee">{t("portal.myTime")}</Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-maple focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Avatar className="h-9 w-9 border border-maple/40">
                    <AvatarFallback className="bg-maple text-maple-foreground font-display tracking-wider text-sm">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">
                  {email || "Signed in"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  {t("portal.settings", { defaultValue: "Settings" })}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("portal.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
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
      <SupportTicketButton />
    </div>
  );
};
