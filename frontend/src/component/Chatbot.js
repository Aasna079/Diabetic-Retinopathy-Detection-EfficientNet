import { useEffect } from "react";

export default function Chatbot() {
  useEffect(() => {
    if (document.getElementById("bp-inject")) return;

    const s1 = document.createElement("script");
    s1.id = "bp-inject";
    s1.src = "https://cdn.botpress.cloud/webchat/v3.6/inject.js";
    s1.async = true;

    s1.onload = () => {
      setTimeout(() => {
        if (window.botpress) {
          window.botpress.init({
            botId: "505438a4-5d73-4246-bfe2-d419454f351e",
            clientId: "53c76325-dcfd-463c-a097-d18da7745da2",
            configuration: {
              botName: "Miki",
              botAvatar: "https://files.bpcontent.cloud/2025/12/03/07/20251203072749-4STTG8B5.jpeg",
              botDescription: "Miki supports and provides assistance to user.",
              color: "#3276EA",
              variant: "solid",
              headerVariant: "glass",
              themeMode: "light",
              fontFamily: "inter",
              radius: 4,
            }
          });
        }
      }, 500);
    };

    document.head.appendChild(s1);
  }, []);

  return null;
}