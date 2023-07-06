PACKAGE=acmart

SAMPLES = rollerblade.tex

PDF = $(PACKAGE).pdf ${SAMPLES:%.tex=%.pdf}

all: rollerblade.pdf

rollerblade.pdf: *.tex *.bib algorithms/*.tex figures/*.pdf *.sty
	xelatex rollerblade.tex && \
	bibtex rollerblade && \
	xelatex rollerblade.tex && \
	xelatex rollerblade.tex && \
	rm -rf *.aux *.log *.out;

minimal:
	xelatex rollerblade.tex

clean:
	$(RM)  *.log *.aux \
	*.cfg *.glo *.idx *.toc \
	*.ilg *.ind *.out *.lof \
	*.lot *.bbl *.blg *.gls *.cut *.hd \
	*.dvi *.ps *.thm *.tgz *.zip *.rpi \
	*.d *.fls *.*.make
	$(RM) rollerblade.pdf

distclean: clean
	$(RM) $(PDF) *-converted-to.pdf
