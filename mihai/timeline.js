// Timeline shared by index.html (visuals) and tools/build_audio.py (voice + SFX).
// t0/t1 = start/end of each voice-over line in seconds. Regenerate with tools/align.py
// after replacing audio/voice.mp3. "|" splits kinetic-type phrases, *x* = green word, !x! = red word.
window.TL = {
  "total": 50.0,
  "segs": [
    {"t0": 0.3, "t1": 3.6, "text": "Ai văzut vreodată un anunț *prea bun* | ca să fie adevărat?"},
    {"t0": 3.9, "t1": 9.0, "text": "Mihai caută de *două săptămâni*. | Când a găsit anunțul perfect, | nu a mai stat pe *gânduri*."},
    {"t0": 9.3, "t1": 15.0, "text": "Proprietarul cere un avans | de *1.500 €*, | prin transfer, azi, | înainte de vizionare."},
    {"t0": 15.3, "t1": 20.0, "text": "Două semne de alarmă: | !grabă!... | și !bani! înainte de orice verificare."},
    {"t0": 20.4, "t1": 23.8, "text": "Mihai deschide *VerifiCasa* | și caută adresa locuinței."},
    {"t0": 24.1, "t1": 29.0, "text": "Datele de proprietate | !nu corespund! | cu cel care cere banii. | Mihai *nu plătește*."},
    {"t0": 29.4, "t1": 38.6, "text": "Pe VerifiCasa vede *turul 3D*, | *comentariile* | și *feedback-ul* altor chiriași. | Iar cu partenerii *Residence Vertical* | și codul *VERIFICASA*, | poate verifica proprietatea complet."},
    {"t0": 38.9, "t1": 41.8, "text": "Extrasul de carte funciară | arată *proprietarul oficial*."},
    {"t0": 42.2, "t1": 48.0, "text": "Data viitoare, | Mihai *verifică* înainte să plătească. | La noi, *transparența* | e mereu pe primul loc."}
  ]
};
