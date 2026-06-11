import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share as ShareIcon, Download, Dog, MapPin, Cat, User as UserIcon } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import { useCatDatabase } from '../context/CatContext';
import { auth, db } from '../config/firebase';

export default function SharePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as any;

  const [shareFinalImage, setShareFinalImage] = useState<string | null>(null);
  const [shareImgSrc, setShareImgSrc] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const shareNodeRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      // 384 is max-w-sm width. If window innerWidth < 416 (padding 16x2), scale it down
      const maxW = Math.min(window.innerWidth - 32, 384);
      setScale(maxW / 384);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    if (!state) {
      navigate(-1);
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state?.type === 'cat' || state?.type === 'submission') {
      const src = state.photoDataUrl || state.cat?.imageUrl;
      if (src && src.startsWith("http")) {
        fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`)
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => setShareImgSrc(reader.result as string);
            reader.readAsDataURL(blob);
          }).catch(() => setShareImgSrc(src));
      } else {
        setShareImgSrc(src);
      }
    }
  }, [state]);

  if (!state) return null;

  const handleShare = async () => {
    if (!shareNodeRef.current) return;
    setIsGenerating(true);
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const pixelRatio = 1080 / shareNodeRef.current.offsetWidth;
      
      if (isIOS) {
        // Safari needs multiple passes to fully load images and fonts into canvas
        await toPng(shareNodeRef.current, { cacheBust: true, pixelRatio, style: { margin: "0" } });
        await new Promise(r => setTimeout(r, 100));
        await toPng(shareNodeRef.current, { cacheBust: true, pixelRatio, style: { margin: "0" } });
        await new Promise(r => setTimeout(r, 100));
        const dataUrl = await toPng(shareNodeRef.current, { cacheBust: true, pixelRatio, style: { margin: "0" } });
        
        setShareFinalImage(dataUrl);
        setIsGenerating(false);
        return;
      }

      const blob = await toBlob(shareNodeRef.current, { cacheBust: true, pixelRatio, style: { margin: "0" } });
      const approved = localStorage.getItem("share_approved");
      if (!approved) {
        const proceed = window.confirm("Do you want to share this? (We won't ask again)");
        if (!proceed) { setIsGenerating(false); return; }
        localStorage.setItem("share_approved", "true");
      }
      if (!blob) return;

      const file = new File([blob], "straykin.jpg", {
        type: blob.type,
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Straykin",
          text: "Check out this on Straykin!",
        });
      } else {
        alert("Sharing not supported on this browser.");
      }
    } catch (e) {
      console.error("Failed to share", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!shareNodeRef.current) return;
    setIsGenerating(true);
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const pixelRatio = 1080 / shareNodeRef.current.offsetWidth;
      
      let dataUrlToSave = "";
      if (isIOS) {
        // Safari needs multiple passes to fully load images and fonts into canvas
        await toPng(shareNodeRef.current, { cacheBust: true, pixelRatio, style: { margin: "0" } });
        await new Promise(r => setTimeout(r, 100));
        await toPng(shareNodeRef.current, { cacheBust: true, pixelRatio, style: { margin: "0" } });
        await new Promise(r => setTimeout(r, 100));
        dataUrlToSave = await toPng(shareNodeRef.current, { cacheBust: true, pixelRatio, style: { margin: "0" } });

        setShareFinalImage(dataUrlToSave);
        setIsGenerating(false);
        return;
      } else {
        dataUrlToSave = await toPng(shareNodeRef.current, { cacheBust: true, pixelRatio, style: { margin: "0" } });
      }

      const approved = localStorage.getItem("save_image_approved");
      if (!approved) {
        const proceed = window.confirm("Do you want to save this image? (We won't ask again)");
        if (!proceed) { setIsGenerating(false); return; }
        localStorage.setItem("save_image_approved", "true");
      }

      const link = document.createElement("a");
      link.download = `straykin_share_${Date.now()}.png`;
      link.href = dataUrlToSave;
      link.click();
    } catch (e) {
      console.error("Failed to generate image", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderCatCard = () => {
    const { cat, topName, userSettings, user } = state;
    return (
      <div className="flex justify-center w-full" style={{ height: 384 * (16/9) * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: 384, height: 384 * (16/9) }}>
          <div id="shareCard" ref={shareNodeRef} className="w-[384px] h-[682.6px] bg-slate-100 rounded-[2.5rem] overflow-hidden relative shadow-2xl flex flex-col mx-auto">
            <div className="w-full h-full absolute inset-0">
              {(shareImgSrc || state.photoDataUrl || cat?.imageUrl) && (
                <img
                  src={shareImgSrc || state.photoDataUrl || cat?.imageUrl || undefined}
                  className="w-full h-[65%] object-cover"
                  crossOrigin={(shareImgSrc || state.photoDataUrl || cat?.imageUrl)?.startsWith("http") ? "anonymous" : undefined}
                />
              )}
            </div>
            <div className="w-full h-[45%] absolute bottom-0 left-0">
              <img src="/card.png" className="w-full h-full object-fill absolute inset-0 z-10" crossOrigin="anonymous" />
              <div className="relative z-20 w-full h-full p-8 pt-16 flex flex-col justify-between">
                <div className="flex justify-between items-start gap-2 pb-[6px] mb-[6px] mt-[9px]">
                  <div className="flex-1 pr-2">
                    <h3 className="text-4xl font-black text-white leading-none break-words mb-0 pb-0">
                      {topName || cat?.name || "Stray"}
                    </h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                      <p className="text-sm font-bold text-white/90 truncate">
                        {cat?.locationName ? (cat.locationName.length > 25 ? cat.locationName.substring(0, 25) + "..." : cat.locationName) : "Spotted near me"}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-white/90">
                      Has been fed by{" "}
                      {(() => {
                        let title = "";
                        const profileStr = localStorage.getItem("user_profile");
                        if (profileStr) {
                          try {
                              const p = JSON.parse(profileStr);
                              if (p.active_title) title = `(${p.active_title}) `;
                          } catch(e) {}
                        }
                        const name = user?.isAnonymous
                          ? `Pawtaker #${user.uid.substring(user.uid.length - 4)}`
                          : userSettings?.displayName ||
                            user?.displayName ||
                            "A Kind Soul";
                        const count = state.checkInCount ? ` (${state.checkInCount} check-ins)` : "";
                        return <>{title}{name}{count}</>;
                      })()}
                    </p>
                  </div>
                  <div className="w-16 h-16 bg-white rounded-xl shadow-lg shrink-0 overflow-hidden">
                    <img
                      src={`/api/proxy-image?url=${encodeURIComponent(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(state.url || window.location.href)}`)}`}
                      alt="QR Code"
                      className="w-full h-full object-contain p-1"
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>
                <div className="flex justify-start items-end -mt-4">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProfileCard = () => {
    const { user, userSettings, profile, firstStrayImage, firstPetImage, firstCheckInImage, checkInCount, strayCount } = state;
    return (
      <div className="flex justify-center w-full" style={{ height: 384 * (16/9) * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: 384, height: 384 * (16/9) }}>
          <div 
            ref={shareNodeRef}
            className="w-[384px] h-[682.6px] shrink-0 bg-white overflow-hidden px-[8cqw] flex flex-col items-center relative origin-top z-0 mx-auto [@container]"
            style={{ backgroundImage: 'url(/AccountCard.png)', backgroundSize: 'cover', backgroundPosition: 'center', paddingTop: '106.4px', paddingBottom: '104.4px' }}
          >
            <div className="flex flex-col items-center w-full mt-0 flex-1 relative z-10 w-full pl-2 pr-[9px] pt-[32px]">
              <div className="w-[100px] h-[100px] bg-[#d9d9d9] rounded-[2rem] mb-6 overflow-hidden flex items-center justify-center border-[4px] border-[#FF6600] shadow-sm">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-1/2 h-1/2 text-slate-400 text-6xl text-center">🐾</div>
                )}
              </div>
              
              <h2 className="text-3xl leading-tight font-black text-black text-center tracking-tight mb-0">
                {userSettings?.displayName || user?.displayName || "App User"}
              </h2>
              <p className="text-lg font-bold text-black text-center tracking-wide mb-8">
                {profile?.active_title || "Neighborhood Caretaker"}
              </p>

              <div className="flex justify-center gap-6 w-full max-w-[320px] mb-12 px-2" style={{ marginTop: '-18px' }}>
                {/* Submitted */}
                <div className="flex flex-col items-center">
                  <div className="relative w-[72px] h-[72px] mb-2">
                    <div className="w-full h-full bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center border-[3px] border-[#FF6600] shadow-sm bg-[#FF6600]/5">
                      {firstStrayImage ? (
                        <img src={firstStrayImage} crossOrigin="anonymous" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-3xl">🐶</div>
                      )}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#FF6600] text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md border-2 border-white">
                      {strayCount !== undefined ? strayCount : (profile?.strays_found?.length || 0)}
                    </div>
                  </div>
                  <span className="text-[15px] font-bold text-slate-800 text-center tracking-tight">
                    Submitted
                  </span>
                </div>

                {/* Check Ins */}
                <div className="flex flex-col items-center">
                  <div className="relative w-[72px] h-[72px] mb-2">
                    <div className="w-full h-full bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center border-[3px] border-[#FF6600] shadow-sm bg-[#FF6600]/5">
                      {firstCheckInImage ? (
                        <img src={firstCheckInImage} crossOrigin="anonymous" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-3xl">🐾</div>
                      )}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#FF6600] text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md border-2 border-white">
                      {checkInCount !== undefined ? checkInCount : (profile?.check_ins?.length || 0)}
                    </div>
                  </div>
                  <span className="text-[15px] font-bold text-slate-800 text-center tracking-tight">
                    Check Ins
                  </span>
                </div>

                {/* Pet */}
                <div className="flex flex-col items-center">
                  <div className="relative w-[72px] h-[72px] mb-2">
                    <div className="w-full h-full bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center border-[3px] border-[#FF6600] shadow-sm bg-[#FF6600]/5">
                      {firstPetImage || profile?.pets?.[0]?.imageUrl ? (
                        <img src={firstPetImage || profile.pets[0].imageUrl} crossOrigin="anonymous" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-3xl">🐱</div>
                      )}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#FF6600] text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md border-2 border-white">
                      {profile?.pets?.length || 0}
                    </div>
                  </div>
                  <span className="text-[15px] font-bold text-slate-800 text-center tracking-tight">
                    Pet
                  </span>
                </div>
              </div>

              <div className="w-[280px] flex justify-center mb-auto mt-2 px-2">
                <div className="bg-[#FF6600] text-white px-8 pt-[9px] pb-[11px] rounded-[16px] font-black text-lg w-[400px] text-center tracking-wide shadow-md" style={{ marginTop: '-29px', marginLeft: '0px', marginBottom: '0px' }}>
                  Join Us
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] w-full overflow-y-auto bg-black text-white px-4 py-8 relative flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 bg-slate-800 rounded-full text-slate-300"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Share {state.type === 'profile' ? 'Profile' : 'Sighting'}</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center pb-32">
        {shareFinalImage ? (
          <div className="w-full max-w-sm flex flex-col items-center animate-in zoom-in-95">
            <img src={shareFinalImage} className="w-full aspect-[9/16] rounded-3xl shadow-2xl mb-6 object-cover" alt="Profile Card" />
            <p className="text-white text-sm font-bold bg-white/20 px-4 py-2 rounded-full animate-pulse">
              Long press the image to save or share
            </p>
          </div>
        ) : (
          state.type === 'profile' ? renderProfileCard() : renderCatCard()
        )}
      </div>

      {!shareFinalImage && (
        <div className="absolute bottom-0 left-0 right-0 w-full max-w-sm mx-auto flex gap-4 shrink-0 pb-[41px] pl-[1px] px-4 z-50 pt-8 mt-0 bg-gradient-to-t from-black via-black/80 to-transparent">
          <button
            disabled={isGenerating}
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 active:scale-95 border-2 border-slate-700 text-white rounded-2xl font-black transition-all disabled:opacity-50 disabled:active:scale-100 disabled:hover:bg-slate-800 shadow-xl"
          >
            <Download className="w-5 h-5" /> Save
          </button>
          <button
            disabled={isGenerating}
            onClick={handleShare}
            className="flex-[2] flex items-center justify-center gap-2 py-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-2xl font-black text-lg transition-all disabled:opacity-50 disabled:active:scale-100 disabled:hover:bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]"
          >
            <ShareIcon className="w-5 h-5 text-white fill-white" /> Share
          </button>
        </div>
      )}
    </div>
  );
}
