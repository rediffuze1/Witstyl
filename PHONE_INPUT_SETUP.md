# 📱 Configuration du composant PhoneNumberInput

## 📦 Dépendances à installer

Le composant `PhoneNumberInput` nécessite les packages suivants :

```bash
npm install react-phone-number-input libphonenumber-js
```

ou avec yarn :

```bash
yarn add react-phone-number-input libphonenumber-js
```

## ✅ Vérification

Après installation, vérifiez que les packages sont bien présents dans `package.json` :

```json
{
  "dependencies": {
    "react-phone-number-input": "^3.x.x",
    "libphonenumber-js": "^1.x.x"
  }
}
```

## 🎯 Utilisation

Le composant est déjà intégré dans le formulaire des stylistes (`client/src/pages/stylistes.tsx`).

### Exemple d'utilisation avec React Hook Form :

```tsx
import { PhoneNumberInput } from "@/components/ui/PhoneNumberInput";
import { isValidPhoneNumber } from "react-phone-number-input";
import { z } from "zod";

// Schéma Zod avec validation
const schema = z.object({
  phone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true; // Optionnel
        return isValidPhoneNumber(val);
      },
      {
        message: "Ce numéro de téléphone est soit invalide, soit au mauvais format.",
      }
    ),
});

// Dans le formulaire
<FormField
  control={form.control}
  name="phone"
  render={({ field, fieldState }) => (
    <FormItem>
      <FormControl>
        <PhoneNumberInput
          label="Téléphone"
          value={field.value || ""}
          onChange={field.onChange}
          defaultCountry="CH"
          error={fieldState.error?.message}
          showValidationState
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

## 🔧 Fonctionnalités

- ✅ Sélection du pays (drapeau + indicatif)
- ✅ Formatage automatique du numéro
- ✅ Validation logique avec la bonne longueur / structure selon le pays
- ✅ Messages d'erreur en français
- ✅ Affichage "Validé" quand le numéro est correct
- ✅ Format E.164 pour le stockage en base de données
- ✅ Style cohérent avec le design glassmorphism du projet

## 📝 Notes

- Le composant retourne toujours le numéro au format E.164 (ex: `+41791338240`)
- La validation utilise `libphonenumber-js` qui est basé sur la bibliothèque Google libphonenumber
- Le composant est compatible avec React Hook Form via `Controller` ou `FormField`



