import { useEffect, useRef, useState } from 'react';
import { useLoader } from '../hooks/useLoader';
import s from './EarthLoader.module.css';

export default function EarthLoader() {
    const { isLoading, loaderMessage } = useLoader();
    const [mounted, setMounted] = useState(false);
    const [closing, setClosing] = useState(false);
    const moonRef = useRef(null);
    const rafRef = useRef(null);

    // Mount / unmount with fade transition
    useEffect(() => {
        if (isLoading) {
            setClosing(false);
            setMounted(true);
        } else if (mounted) {
            setClosing(true);
            const timer = setTimeout(() => {
                setMounted(false);
                setClosing(false);
            }, 380); // match CSS transition duration
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    // Moon orbit animation
    useEffect(() => {
        if (!mounted) return;

        const moon = moonRef.current;
        if (!moon) return;

        const earthEm = 7.5 * 16;
        const rx = earthEm * 0.82;
        const ry = earthEm * 0.28;
        const period = 5000;
        let start = null;

        function orbit(ts) {
            if (!start) start = ts;
            const elapsed = (ts - start) % period;
            const t = elapsed / period;
            const angle = 2 * Math.PI * t;

            const x = rx * Math.cos(angle);
            const y = ry * Math.sin(angle);

            const sinVal = Math.sin(angle);
            const isBehind = sinVal < 0;

            const scale = isBehind ? 0.72 - 0.12 * (-sinVal) : 0.78 + 0.18 * sinVal;
            const opacity = isBehind ? 0 : 0.7 + 0.3 * sinVal;

            moon.style.left = x + 'px';
            moon.style.top = y + 'px';
            moon.style.transform = `translate(-50%, -50%) scale(${scale})`;
            moon.style.opacity = opacity;
            moon.style.zIndex = isBehind ? 1 : 10;

            rafRef.current = requestAnimationFrame(orbit);
        }

        rafRef.current = requestAnimationFrame(orbit);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [mounted]);

    if (!mounted) return null;

    const overlayClass = [
        s.overlay,
        !closing ? s.visible : '',
        closing ? s.closing : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={overlayClass}>
            <div className={s.earthScene}>
                <div className={s.earthWrap}>

                    {/* Chat bubble badge */}
                    <div className={s.commentBadge}>
                        <svg width="36" height="36" viewBox="0 0 24 24"
                            fill="white" stroke="white" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 12c0 4-3 7-8 7H8l-4 3v-5c-1-1.2-2-3-2-5 0-4 3-7 8-7h4c5 0 6 3 6 7z" />
                        </svg>
                    </div>

                    {/* Earth globe */}
                    <div className={s.earth}>
                        <div className={s.earthLoader}>
                            {/* Land masses */}
                            <svg className={s.land1} viewBox="0 0 200 200"><path transform="translate(100 100)" d="M29.4,-17.4C33.1,1.8,27.6,16.1,11.5,31.6C-4.7,47,-31.5,63.6,-43,56C-54.5,48.4,-50.7,16.6,-41,-10.9C-31.3,-38.4,-15.6,-61.5,-1.4,-61C12.8,-60.5,25.7,-36.5,29.4,-17.4Z" fill="#7CC133" /></svg>
                            <svg className={s.land2} viewBox="0 0 200 200"><path transform="translate(100 100)" d="M31.7,-55.8C40.3,-50,45.9,-39.9,49.7,-29.8C53.5,-19.8,55.5,-9.9,53.1,-1.4C50.6,7.1,43.6,14.1,41.8,27.6C40.1,41.1,43.4,61.1,37.3,67C31.2,72.9,15.6,64.8,1.5,62.2C-12.5,59.5,-25,62.3,-31.8,56.7C-38.5,51.1,-39.4,37.2,-49.3,26.3C-59.1,15.5,-78,7.7,-77.6,0.2C-77.2,-7.2,-57.4,-14.5,-49.3,-28.4C-41.2,-42.4,-44.7,-63,-38.5,-70.1C-32.2,-77.2,-16.1,-70.8,-2.3,-66.9C11.6,-63,23.1,-61.5,31.7,-55.8Z" fill="#7CC133" /></svg>
                            <svg className={s.land3} viewBox="0 0 200 200"><path transform="translate(100 100)" d="M30.6,-49.2C42.5,-46.1,57.1,-43.7,67.6,-35.7C78.1,-27.6,84.6,-13.8,80.3,-2.4C76.1,8.9,61.2,17.8,52.5,29.1C43.8,40.3,41.4,53.9,33.7,64C26,74.1,13,80.6,2.2,76.9C-8.6,73.1,-17.3,59,-30.6,52.1C-43.9,45.3,-61.9,45.7,-74.1,38.2C-86.4,30.7,-92.9,15.4,-88.6,2.5C-84.4,-10.5,-69.4,-20.9,-60.7,-34.6C-52.1,-48.3,-49.8,-65.3,-40.7,-70C-31.6,-74.8,-15.8,-67.4,-3.2,-61.8C9.3,-56.1,18.6,-52.3,30.6,-49.2Z" fill="#7CC133" /></svg>
                            <svg className={s.land4} viewBox="0 0 200 200"><path transform="translate(100 100)" d="M39.4,-66C48.6,-62.9,51.9,-47.4,52.9,-34.3C53.8,-21.3,52.4,-10.6,54.4,1.1C56.3,12.9,61.7,25.8,57.5,33.2C53.2,40.5,39.3,42.3,28.2,46C17,49.6,8.5,55.1,1.3,52.8C-5.9,50.5,-11.7,40.5,-23.6,37.2C-35.4,34,-53.3,37.5,-62,32.4C-70.7,27.4,-70.4,13.7,-72.4,-1.1C-74.3,-15.9,-78.6,-31.9,-73.3,-43C-68.1,-54.2,-53.3,-60.5,-39.5,-60.9C-25.7,-61.4,-12.9,-56,1.1,-58C15.1,-59.9,30.2,-69.2,39.4,-66Z" fill="#7CC133" /></svg>

                            {/* Clouds */}
                            <svg className={s.cloud1} viewBox="0 0 200 200"><path transform="translate(100 100)" d="M18,-8C22,2,20,12,10,20C0,28,-18,34,-28,26C-38,18,-40,-4,-32,-18C-24,-32,-6,-38,8,-34C22,-30,14,-18,18,-8Z" fill="white" /><path transform="translate(100 100) translate(30 15)" d="M12,-5C15,2,13,9,6,14C-1,19,-12,21,-18,15C-24,9,-24,-3,-18,-12C-12,-21,-4,-26,4,-22C12,-18,9,-12,12,-5Z" fill="white" /></svg>
                            <svg className={s.cloud2} viewBox="0 0 200 200"><path transform="translate(100 100)" d="M22,-10C26,4,22,16,12,24C2,32,-14,36,-26,28C-38,20,-46,-2,-38,-18C-30,-34,-8,-44,8,-40C24,-36,18,-24,22,-10Z" fill="white" /></svg>
                            <svg className={s.cloud3} viewBox="0 0 200 200"><path transform="translate(100 100)" d="M14,-6C18,3,16,11,8,17C0,23,-14,27,-22,20C-30,13,-30,-2,-22,-14C-14,-26,-4,-34,6,-30C16,-26,10,-15,14,-6Z" fill="white" /><path transform="translate(100 100) translate(-25 10)" d="M10,-4C13,2,11,8,5,12C-1,16,-10,18,-16,12C-22,6,-22,-4,-14,-10C-6,-16,-2,-20,4,-18C10,-16,7,-10,10,-4Z" fill="white" /></svg>
                            <svg className={s.cloud4} viewBox="0 0 200 200"><path transform="translate(100 100)" d="M20,-9C24,3,20,14,10,21C0,28,-16,31,-26,24C-36,17,-40,-2,-32,-16C-24,-30,-8,-40,6,-36C20,-32,16,-21,20,-9Z" fill="white" /></svg>
                        </div>

                        <p className={s.earthText}>
                            {loaderMessage || 'Connecting'}
                            <span className={s.dot}>.</span>
                            <span className={s.dot}>.</span>
                            <span className={s.dot}>.</span>
                        </p>
                    </div>

                    {/* Moon orbit */}
                    <div className={s.moonOrbit}>
                        <div className={s.moonBall} ref={moonRef}>
                            <svg className={s.mc1} viewBox="0 0 200 200">
                                <circle cx="70" cy="120" r="28" fill="#5a5a5a" opacity="0.85" /><circle cx="70" cy="120" r="22" fill="#6e6e6e" />
                                <circle cx="130" cy="80" r="18" fill="#5a5a5a" opacity="0.8" /><circle cx="130" cy="80" r="13" fill="#686868" />
                                <circle cx="50" cy="60" r="12" fill="#525252" opacity="0.75" /><circle cx="50" cy="60" r="8" fill="#636363" />
                            </svg>
                            <svg className={s.mc2} viewBox="0 0 200 200">
                                <circle cx="100" cy="130" r="30" fill="#545454" opacity="0.9" /><circle cx="100" cy="130" r="23" fill="#6a6a6a" />
                                <circle cx="150" cy="100" r="20" fill="#585858" opacity="0.85" /><circle cx="150" cy="100" r="14" fill="#6c6c6c" />
                            </svg>
                            <svg className={s.mc3} viewBox="0 0 200 200">
                                <circle cx="80" cy="100" r="25" fill="#8c8c8c" opacity="0.7" /><circle cx="80" cy="100" r="19" fill="#a0a0a0" />
                                <circle cx="140" cy="130" r="16" fill="#888888" opacity="0.65" /><circle cx="140" cy="130" r="11" fill="#9e9e9e" />
                            </svg>
                            <svg className={s.mc4} viewBox="0 0 200 200">
                                <circle cx="60" cy="90" r="9" fill="#606060" opacity="0.8" /><circle cx="60" cy="90" r="6" fill="#747474" />
                                <circle cx="120" cy="140" r="11" fill="#929292" opacity="0.7" /><circle cx="120" cy="140" r="7" fill="#ababab" />
                            </svg>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
