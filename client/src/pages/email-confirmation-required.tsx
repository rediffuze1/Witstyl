import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";

export default function EmailConfirmationRequired() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">Vérifie ton email</CardTitle>
          <CardDescription className="text-slate-600">
            Un email de confirmation a été envoyé à votre adresse.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-2">📧 Prochaines étapes :</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ouvrez votre boîte mail</li>
              <li>Cliquez sur le lien de confirmation</li>
              <li>Revenez ici pour vous connecter</li>
            </ol>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <p className="font-medium mb-2">⚠️ Important :</p>
            <p>Vous devez confirmer votre email avant de pouvoir vous connecter.</p>
          </div>
          
          <Button 
            onClick={() => setLocation("/salon-login")}
            className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Aller à la connexion
          </Button>
          
          <Button 
            type="button"
            variant="outline" 
            onClick={() => setLocation("/salon-register")}
            className="w-full h-12 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à l'inscription
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

