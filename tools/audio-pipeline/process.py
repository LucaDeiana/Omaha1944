"""Pipeline degli asset audio (Omaha1944): master WAV/FLAC -> asset web verificati, con manifest delle licenze.

    python tools/audio-pipeline/process.py <cartella_master> <cartella_uscita> [licenze.csv]

licenze.csv: file,categoria,licenza,autore,fonte (una riga per file; senza licenza il file viene RIFIUTATO).
Per ogni file: verifica (formato, frequenza, canali, durata, clipping), taglio del silenzio iniziale/finale (soglia -60 dBFS,
la coda naturale resta), normalizzazione CONTROLLATA per categoria (loudness integrata EBU R128 con obiettivi diversi:
gli spari restano più forti delle meccaniche; tetto di picco reale -1 dBTP), conversione a 48 kHz in Ogg Vorbis q6
(e AAC .m4a per Safari), metadati in manifest.json. I master non vengono mai modificati.
"""
import csv
import json
import os
import subprocess
import sys

TARGET = {'sparo': -14.0, 'sparo_lontano': -20.0, 'meccanica': -22.0, 'esplosione': -12.0, 'ambiente': -26.0, 'voce': -20.0, 'ui': -24.0}
OK_LIC = ('CC0', 'CC-BY', 'PD', 'CC-BY-4.0', 'CC-BY-3.0', 'CC0-1.0')


def ff(*a):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', *a], capture_output=True, text=True)
    return r.returncode, r.stderr


def probe(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=sample_rate,channels,bits_per_sample,codec_name:format=duration', '-of', 'json', p], capture_output=True, text=True)
    j = json.loads(r.stdout or '{}')
    s = (j.get('streams') or [{}])[0]
    return dict(sr=int(s.get('sample_rate', 0)), ch=int(s.get('channels', 0)), bits=int(s.get('bits_per_sample') or 0), codec=s.get('codec_name'), dur=float(j.get('format', {}).get('duration', 0)))


def loudness(p):
    _, err = ff('-i', p, '-af', 'loudnorm=print_format=json', '-f', 'null', '-')
    i = err.rfind('{')
    try:
        return json.loads(err[i:err.rfind('}') + 1])
    except Exception:  # noqa: BLE001
        return {}


def process(src_dir, out_dir, lic_csv=None):
    os.makedirs(out_dir, exist_ok=True)
    lic = {}
    if lic_csv and os.path.exists(lic_csv):
        for row in csv.DictReader(open(lic_csv)):
            lic[row['file']] = row
    man, errors = [], []
    for f in sorted(os.listdir(src_dir)):
        if not f.lower().endswith(('.wav', '.flac')):
            continue
        p = os.path.join(src_dir, f)
        L = lic.get(f)
        if not L or not any(L['licenza'].upper().startswith(x) for x in OK_LIC):
            errors.append('%s: licenza mancante o non compatibile, file rifiutato' % f)
            continue
        info = probe(p)
        warn = []
        if info['sr'] < 44100:
            warn.append('frequenza %d Hz (< 44,1 kHz): qualità limitata' % info['sr'])
        if info['dur'] < .5 and L['categoria'] == 'sparo':
            warn.append('durata %.2f s: probabile coda tagliata' % info['dur'])
        ln = loudness(p)
        if ln and float(ln.get('input_tp', -99)) > -0.1:
            warn.append('clipping nel master (picco reale %s dBTP)' % ln.get('input_tp'))
        base = os.path.splitext(f)[0]
        tgt = TARGET.get(L['categoria'], -20.0)
        flt = ('silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.005,areverse,'
               'silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.05,areverse,'
               'loudnorm=I=%.1f:TP=-1.0:LRA=20,aresample=48000' % tgt)
        o1 = os.path.join(out_dir, base + '.ogg')
        rc, err = ff('-i', p, '-af', flt, '-c:a', 'libvorbis', '-q:a', '6', o1)
        if rc:
            errors.append('%s: conversione fallita: %s' % (f, err[-200:]))
            continue
        ff('-i', o1, '-c:a', 'aac', '-b:a', '160k', os.path.join(out_dir, base + '.m4a'))
        outi = probe(o1)
        lo = loudness(o1)
        man.append(dict(file=base, master=f, categoria=L['categoria'], licenza=L['licenza'], autore=L.get('autore', ''), fonte=L.get('fonte', ''),
                        master_info=info, uscita=dict(sr=outi['sr'], durata=round(outi['dur'], 3), lufs=lo.get('input_i'), picco_dBTP=lo.get('input_tp')),
                        obiettivo_lufs=tgt, avvisi=warn))
    json.dump(dict(asset=man, errori=errors), open(os.path.join(out_dir, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    return man, errors


if __name__ == '__main__':
    m, e = process(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    for a in m:
        print('%-18s %-10s %5.2f s  %s LUFS  %s dBTP  %s' % (a['file'], a['categoria'], a['uscita']['durata'], a['uscita']['lufs'], a['uscita']['picco_dBTP'], '; '.join(a['avvisi'])))
    for x in e:
        print('ERRORE', x)
