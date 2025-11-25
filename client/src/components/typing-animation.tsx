import { useState, useEffect } from "react";

const subtitles = [
  "Choisissez votre coiffeur préféré.",
  "Parlez à notre réceptionniste IA.",
  "Payez et recevez vos rappels automatiques.",
  "Gérez, modifiez, annulez en 1 clic."
];

export default function TypingAnimation() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const currentSubtitle = subtitles[currentIndex];
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      // Typing effect
      if (displayText.length < currentSubtitle.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentSubtitle.slice(0, displayText.length + 1));
        }, 50);
      } else {
        // Finished typing, wait before starting to delete
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    } else {
      // Deleting effect
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 30);
      } else {
        // Finished deleting, move to next subtitle
        setCurrentIndex((prev) => (prev + 1) % subtitles.length);
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, isTyping, currentIndex]);

  return (
    <p className="text-xl sm:text-2xl text-foreground font-medium typing-text min-h-[2rem] flex items-center justify-center">
      {displayText}
      <span className="animate-pulse text-primary ml-1">|</span>
    </p>
  );
}
