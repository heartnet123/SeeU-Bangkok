import { useEffect, useState } from "react";

interface UseTypewriterResult {
	displayed: string;
	done: boolean;
}

export function useTypewriter(text: string, speed = 6): UseTypewriterResult {
	const [displayed, setDisplayed] = useState("");
	const [done, setDone] = useState(false);

	useEffect(() => {
		if (!text) {
			setDisplayed("");
			setDone(false);
			return;
		}
		setDone(false);
		setDisplayed("");
		let i = 0;
		const timer = setInterval(() => {
			i += 1;
			setDisplayed(text.slice(0, i));
			if (i >= text.length) {
				clearInterval(timer);
				setDone(true);
			}
		}, speed);
		return () => clearInterval(timer);
	}, [text, speed]);

	return { displayed, done };
}
