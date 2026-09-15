import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import logo from '@/assets/logocapinegro.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Safety timeout to avoid infinite loading
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        setIsLoading(false);
        toast({
          title: "Tiempo de espera agotado",
          description: "El servidor tardó demasiado en responder. Intenta de nuevo.",
          variant: "destructive",
        });
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, toast]);

  useEffect(() => {
    if (user && !profileLoading && profile) {
      // Redirect based on profile_type
      if (profile.profile_type === 'superadmin') {
        navigate('/admin');
      } else if (profile.profile_type === 'client' || profile.profile_type === 'cajero') {
        navigate('/leads');
      }
    }
  }, [user, profile, profileLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Por favor, completa todos los campos",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Error de autenticación",
        description: error.message === 'Invalid login credentials'
          ? "Email o contraseña incorrectos"
          : "Error al iniciar sesión. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Bienvenido",
        description: "Has iniciado sesión correctamente",
      });
      // Navigation will be handled by useEffect based on profile_type
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile Logo - Only visible on small screens */}
      <div className="lg:hidden flex justify-center py-8 px-4 bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-2xl p-2">
            <img
              src={logo}
              alt="Capibet Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-foreground text-2xl font-bold">CAPIBET</h1>
        </div>
      </div>

      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-6 lg:p-8 bg-background">
        <div className="w-full max-w-md">
          <h1 className="text-foreground text-2xl lg:text-3xl font-semibold mb-6 lg:mb-8 text-center lg:text-left">
            Iniciar sesión
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input with Icon */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full pl-10 pr-4 py-4 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base transition-all"
                required
                disabled={isLoading}
              />
            </div>

            {/* Password Input with Icon and Toggle */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full pl-10 pr-12 py-4 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base transition-all"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-muted/10 rounded-r-lg transition-colors duration-200"
              >
                <div className="p-1 rounded-full hover:bg-muted/20 transition-colors duration-200">
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  )}
                </div>
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted disabled:cursor-not-allowed text-white font-semibold py-4 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background text-base"
            >
              {isLoading ? 'Iniciando sesión...' : 'INICIAR SESIÓN'}
            </Button>
          </form>

          {/* Version Info */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Versión 3.11.0 10-09-26
            </p>
          </div>
        </div>
      </div>

      {/* Right side - CAPIBET Logo */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-primary via-primary to-secondary/50 relative overflow-hidden">
        <div className="text-center z-10">
          <div className="mb-8">
            {/* CAPIBET Logo */}
            <div className="w-32 h-32 mx-auto rounded-full flex items-center justify-center shadow-2xl overflow-hidden bg-white p-4">
              <img
                src={logo}
                alt="Capibet Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h1 className="text-white text-6xl font-bold mb-2">CAPIBET</h1>
          <div className="flex items-center justify-center gap-4">
            <div className="h-1 w-16 bg-white/50"></div>
            <span className="text-white text-xl font-medium tracking-wider">CRM</span>
            <div className="h-1 w-16 bg-white/50"></div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-32 h-32 border border-white/20 rounded-full"></div>
          <div className="absolute bottom-20 right-20 w-48 h-48 border border-white/20 rounded-full"></div>
          <div className="absolute top-1/2 left-10 w-24 h-24 border border-white/20 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default Login;
