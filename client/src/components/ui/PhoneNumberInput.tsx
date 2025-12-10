"use client"

import React, { useState, useEffect } from "react";
import PhoneInput, { type Country, isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

export type PhoneNumberInputProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country; // ex: "CH", "FR"
  required?: boolean;
  error?: string | null;
  showValidationState?: boolean; // affiche "Validé" / message d'erreur
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * Composant de saisie de numéro de téléphone international réutilisable
 * 
 * Utilise react-phone-number-input + libphonenumber-js pour :
 * - Sélection du pays (drapeau + indicatif)
 * - Formatage automatique du numéro
 * - Validation logique avec la bonne longueur / structure selon le pays
 * 
 * @example
 * ```tsx
 * <PhoneNumberInput
 *   label="Téléphone"
 *   value={phone}
 *   onChange={setPhone}
 *   defaultCountry="CH"
 *   showValidationState
 * />
 * ```
 * 
 * @requires npm install react-phone-number-input libphonenumber-js
 */
export function PhoneNumberInput({
  label,
  value,
  onChange,
  defaultCountry = "CH",
  required = false,
  error: externalError,
  showValidationState = false,
  className,
  placeholder,
  disabled = false,
}: PhoneNumberInputProps) {
  const [country, setCountry] = useState<Country>(defaultCountry);
  const [phoneValue, setPhoneValue] = useState<string>(value || "");
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Synchroniser la valeur externe
  useEffect(() => {
    setPhoneValue(value || "");
  }, [value]);

  // Validation du numéro
  useEffect(() => {
    if (!phoneValue || phoneValue.trim() === "") {
      setIsValid(null);
      return;
    }

    // Valider avec libphonenumber
    const valid = isValidPhoneNumber(phoneValue);
    setIsValid(valid);
  }, [phoneValue]);

  const handleChange = (newValue: string | undefined) => {
    const val = newValue || "";
    setPhoneValue(val);
    setHasInteracted(true);
    
    // Toujours appeler onChange pour que React Hook Form soit synchronisé
    // La validation sera gérée par Zod dans le schéma
    onChange(val);
  };

  const handleCountryChange = (newCountry: Country | undefined) => {
    if (newCountry) {
      setCountry(newCountry);
    }
  };

  // Déterminer l'état d'erreur
  const hasError = externalError !== null && externalError !== undefined && externalError !== "";
  const showError = hasError || (hasInteracted && phoneValue && isValid === false);
  const showValid = showValidationState && hasInteracted && phoneValue && isValid === true && !hasError;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div
        className={cn(
          "relative flex items-center rounded-xl border bg-background transition-colors",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          showError
            ? "border-destructive focus-within:border-destructive focus-within:ring-destructive"
            : showValid
            ? "border-green-500 focus-within:border-green-500 focus-within:ring-green-500/20"
            : "border-input focus-within:border-ring",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Container pour react-phone-number-input */}
        <div className="flex-1">
          <PhoneInput
            international
            defaultCountry={defaultCountry}
            value={phoneValue}
            onChange={handleChange}
            onCountryChange={handleCountryChange}
            placeholder={placeholder || undefined}
            disabled={disabled}
            className={cn(
              "phone-input-custom",
              "w-full"
            )}
            numberInputProps={{
              className: cn(
                "flex h-10 w-full rounded-r-xl border-0 bg-transparent px-3 py-2 text-base",
                "ring-offset-background",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "md:text-sm"
              ),
            }}
            countrySelectProps={{
              className: cn(
                "flex h-10 items-center rounded-l-xl border-0 bg-transparent px-3 py-2",
                "focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50"
              ),
            }}
          />
        </div>

        {/* Icône de validation */}
        {showValid && (
          <div className="absolute right-3 flex items-center">
            <Check className="h-4 w-4 text-green-600" />
          </div>
        )}
        {showError && !showValid && (
          <div className="absolute right-3 flex items-center">
            <X className="h-4 w-4 text-destructive" />
          </div>
        )}
      </div>

      {/* Messages de validation */}
      {showError && (
        <p className="text-sm font-medium text-destructive">
          {externalError || "Ce numéro de téléphone est soit invalide, soit au mauvais format."}
        </p>
      )}
      {showValid && (
        <p className="text-sm font-medium text-green-600">Validé</p>
      )}
    </div>
  );
}

// Styles CSS personnalisés pour react-phone-number-input
// Ces styles sont injectés via un style tag pour éviter les conflits
if (typeof document !== "undefined") {
  const styleId = "phone-number-input-custom-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .phone-input-custom .PhoneInputInput {
        border: none !important;
        outline: none !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      
      .phone-input-custom .PhoneInputInput:focus {
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
      }
      
      .phone-input-custom .PhoneInputCountry {
        border: none !important;
        background: transparent !important;
        margin-right: 0 !important;
        padding-right: 8px !important;
      }
      
      .phone-input-custom .PhoneInputCountryIcon {
        width: 1.5em !important;
        height: 1.5em !important;
        box-shadow: none !important;
        border: none !important;
      }
      
      .phone-input-custom .PhoneInputCountrySelect {
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
        margin: 0 !important;
        font-size: inherit !important;
        cursor: pointer !important;
      }
      
      .phone-input-custom .PhoneInputCountrySelectArrow {
        opacity: 0.5 !important;
        margin-left: 4px !important;
      }
    `;
    document.head.appendChild(style);
  }
}

