PACKAGE=acmart

SAMPLES = rollerblade.tex

PDF = $(PACKAGE).pdf ${SAMPLES:%.tex=%.pdf}

all: rollerblade.pdf

rollerblade.pdf: *.tex *.bib algorithms/*.tex figures/*.pdf *.sty
	pdflatex rollerblade.tex && \
	bibtex rollerblade && \
	pdflatex rollerblade.tex && \
	pdflatex rollerblade.tex && \
	rm -rf *.aux *.log *.out;

minimal:
	pdflatex rollerblade.tex

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
